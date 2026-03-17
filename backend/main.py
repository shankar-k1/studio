from fastapi import FastAPI, HTTPException, UploadFile, File, Form, BackgroundTasks, Depends, Header
from sqlalchemy import text
from pydantic import BaseModel
from typing import List, Optional, Dict
from modules.email_module import EmailModule
from modules.scrubbing_engine import ScrubbingEngine
from modules.alerting_system import AlertingSystem
from modules.upload_handler import UploadHandler
from modules.database_module import DatabaseModule
from agents.obd_prompt_agent import OBDPromptAgent
from agents.email_csv_agent import EmailCSVAgent
from modules.voip_module import voip_module
from modules.logging_system import logger
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response
import jwt
import os
import threading
import asyncio
from contextlib import asynccontextmanager
try:
    from pyngrok import ngrok
except ImportError:
    ngrok = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    public_url = None
    if os.getenv("USE_NGROK") == "true" and ngrok:
        authtoken = os.getenv("NGROK_AUTHTOKEN")
        if authtoken:
            ngrok.set_auth_token(authtoken)
        try:
            tunnel = ngrok.connect(8000)
            public_url = tunnel.public_url
            app.state.public_url = public_url
            print(f"DEBUG: NGROK Tunnel Active: {public_url}")
        except Exception as e:
            print(f"WARNING: NGROK failed to start: {e}")
    else:
        app.state.public_url = None

    yield
    # Shutdown logic
    if ngrok:
        ngrok.kill()
        print("DEBUG: NGROK Tunnel stopped.")
    
    from modules.load_distributor import load_distributor
    load_distributor.shutdown()
    print("DEBUG: Application shutdown. LoadDistributor stopped.")

app = FastAPI(title="Outsmart OBD Agent API", lifespan=lifespan)

# Auth / JWT configuration
JWT_SECRET = os.getenv("JWT_SECRET", "dev_obd_secret_change_me")
JWT_ALGORITHM = "HS256"
JWT_EXP_SECONDS = int(os.getenv("JWT_EXP_SECONDS", "86400"))


def create_token(username: str) -> str:
    import datetime as _dt
    payload = {
        "sub": username,
        "exp": _dt.datetime.utcnow() + _dt.timedelta(seconds=JWT_EXP_SECONDS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_username(authorization: str = Header(None)):
    """
    Minimal auth helper.
    Frontend should send token via either:
    - Authorization header: 'Bearer <token>' (preferred in future)
    - Or as 'authorization' form field for existing forms.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.split(" ", 1)[1]

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return username
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/public-url")
async def get_public_url():
    return {"public_url": getattr(app.state, 'public_url', None)}

# Initialize Modules
email_module = EmailModule()
scrubbing_engine = ScrubbingEngine()
alerting_system = AlertingSystem()
upload_handler = UploadHandler()
prompt_agent = OBDPromptAgent()
db = DatabaseModule()

@app.get("/ai-status")
async def get_ai_status():
    """Returns the health status of the AI Engine."""
    if prompt_agent.model:
        return {
            "status": "Online",
            "model": prompt_agent.model,
            "provider": "Google Gemini"
        }
    return {
        "status": "Offline",
        "detail": "No LLM API Key or SDK configured"
    }

@app.get("/")
async def root():
    db_url = os.getenv("DATABASE_URL")
    # Mask URL for safety but show if it's there
    masked_url = f"{db_url[:15]}...{db_url[-5:]}" if db_url else "MISSING"
    return {
        "message": "Outsmart OBD API is Live (FastAPI)",
        "db_configured": db_url is not None,
        "db_url_status": masked_url,
        "db_init_status": "OK" if not getattr(db, 'init_error', "") else f"FAIL: {db.init_error}",
        "db_type": os.getenv("DB_TYPE", "postgresql"),
        "host": os.getenv("RENDER_HOSTNAME", "localhost")
    }

# No background email polling - agent is triggered after scrubbing or manually

class FlowRequest(BaseModel):
    email_context: str

class ScheduleRequest(BaseModel):
    obd_name: str
    flow_name: str
    msc_ip: str
    cli: str

class ProcessRequest(BaseModel):
    msisdn_list: Optional[List[str]] = []
    operator: Optional[str] = None
    email_context: Optional[str] = None
    options: Optional[Dict[str, bool]] = None
    username: Optional[str] = None

class LogScrubRequest(BaseModel):
    total_input: int
    final_count: int
    dnd_removed: int
    sub_removed: int
    unsub_removed: int
    operator_removed: int
    msisdn_list: List[str] = []

class FlowXMLRequest(BaseModel):
    xml_content: str

class FlowDocRequest(BaseModel):
    doc_text: str

class LoginRequest(BaseModel):
    username: str
    password: str



@app.get("/fetch-request")
async def fetch_request():
    """Fetches the latest OBD request from email."""
    try:
        request = email_module.fetch_latest_obd_request()
        if request:
            details = email_module.extract_obd_details(request["body"])
            return {"email": request, "extracted_details": details}
        return {"message": "No new requests found"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/login")
async def login(request: LoginRequest):
    if db.verify_admin_user(request.username, request.password):
        token = create_token(request.username)
        return {"status": "success", "token": token, "username": request.username}
    raise HTTPException(status_code=401, detail="Invalid username or password")

@app.get("/auth/me")
async def auth_me(username: str = Depends(get_current_username)):
    return {"username": username, "status": "authenticated"}

@app.post("/create-user")
async def create_user(request: LoginRequest):
    if db.create_admin_user(request.username, request.password):
        return {"status": "success", "message": f"User {request.username} successfully created in database"}
    raise HTTPException(status_code=500, detail="Failed to create user or user already exists")

@app.post("/scrub")
async def scrub_base(request: ProcessRequest, current_username: str = Depends(get_current_username)):
    """
    Creates a scrub job for the provided MSISDN list with specific options.
    Heavy scrubbing is handled asynchronously by a worker.
    """
    try:
        msisdns = request.msisdn_list or []
        if not msisdns:
            raise HTTPException(status_code=400, detail="Empty MSISDN list")

        # Determine logical username from auth token
        username = current_username

        # 1. Create job metadata
        job_id = db.create_scrub_job(
            username=username,
            total_input=len(msisdns),
            operator=request.operator,
            options=request.options or {},
        )
        if not job_id:
            raise HTTPException(status_code=500, detail="Failed to create scrub job")

        # 2. Persist raw inputs for chunked processing
        if not db.add_scrub_job_inputs(job_id, msisdns):
            raise HTTPException(status_code=500, detail="Failed to persist job inputs")

        # 3. Enqueue for background processing (Redis or in-process worker will pick it up)
        try:
            from modules.cache_engine import cache_engine
            queue_key = "scrub_jobs_queue"
            existing = cache_engine.get(queue_key) or []
            existing.append(job_id)
            cache_engine.set(queue_key, existing, expire=None)
        except Exception as qe:
            print(f"Queue Enqueue Warning: {qe}")

        logger.log(
            "backend",
            "info",
            f"Scrub job {job_id} created for user {username} with {len(msisdns)} records",
            "scrub",
        )

        return {
            "job_id": job_id,
            "status": "QUEUED",
            "total_input": len(msisdns),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.log("backend", "error", f"Scrub job creation error: {e}", "scrub")
        raise HTTPException(status_code=500, detail=str(e))

def post_scrub_processing(final_base, report):
    """Heavy I/O tasks run in background to prevent UI timeouts."""
    import time
    start_time = time.time()
    logger.log("backend", "info", "Starting post-scrub background processing...", "post_scrub")
    
    # 1. Save to Database
    table_name = "NONE"
    try:
        logger.log("database", "info", f"Saving {len(final_base)} targets to database...", "scrub_results")
        db_start = time.time()
        save_ok, table_name = db.save_verified_scrub_results(final_base)
        duration = time.time() - db_start
        if save_ok:
            logger.log("database", "success", f"Scrub results saved to '{table_name}' ({duration:.2f}s)", "scrub_results")
        else:
            logger.log("database", "error", f"Failed to save scrub results ({duration:.2f}s)", "scrub_results")
    except Exception as e:
        logger.log("database", "error", f"DB save failed: {e}", "scrub_results")

    # 2. Email Report
    try:
        logger.log("email", "info", "Sending scrubbing report via email...", "scrub_report")
        email_ok, email_msg = email_module.send_scrub_report(report, msisdns=final_base)
        if email_ok:
            logger.log("email", "success", "Scrubbing report email sent successfully", "scrub_report")
        else:
            logger.log("email", "error", f"Email failed: {email_msg}", "scrub_report")
    except Exception as e:
        logger.log("email", "error", f"Email sending failed: {e}", "scrub_report")

    # 3. Auto-trigger Email CSV Sync Agent
    try:
        logger.log("email", "info", "Auto-triggering Email CSV Sync Agent (10 min polling)...", "csv_sync")
        agent = EmailCSVAgent()
        sync_thread = threading.Thread(
            target=lambda: agent.wait_and_sync(poll_interval=30, max_wait=600),
            daemon=True
        )
        sync_thread.start()
        logger.log("email", "success", "Email CSV Sync Agent started in background", "csv_sync")
    except Exception as e:
        logger.log("email", "error", f"Failed to start CSV Sync Agent: {e}", "csv_sync")
        
    duration = time.time() - start_time
    logger.log("backend", "success", f"Post-scrub processing completed ({duration:.2f}s)", "post_scrub")

class LaunchRequest(BaseModel):
    msisdn_list: List[str]
    project_name: str = "default"

class VOIPRequest(BaseModel):
    msisdn: str
    shortcode: str
    script: Optional[str] = None


@app.get("/scrub-job/{job_id}")
async def get_scrub_job(job_id: int, current_username: str = Depends(get_current_username)):
    """Returns metadata for a single scrub job."""
    job = db.get_scrub_job(job_id, username=current_username)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"job": job}

@app.get("/scrub-results/{table_name}")
async def get_scrub_results(table_name: str, current_username: str = Depends(get_current_username)):
    """Fetches verified MSISDNs from a completed scrub results table."""
    # Basic safety check to ensure it's a scrub results table
    if not table_name.startswith("scrub_results_") and not table_name.startswith("email_csv_"):
        raise HTTPException(status_code=400, detail="Invalid results table name")
    
    try:
        rows = db.execute_query(f"SELECT msisdn FROM {table_name} LIMIT 10000")
        msisdns = [r['msisdn'] for r in rows]
        return {"msisdns": msisdns, "total": len(msisdns)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/scrub-jobs")
async def list_scrub_jobs(current_username: str = Depends(get_current_username)):
    """Lists recent scrub jobs for a user."""
    jobs = db.list_scrub_jobs(username=current_username)
    return {"jobs": jobs}

@app.post("/launch-campaign")
async def launch_campaign(request: LaunchRequest):
    """Saves verified MSISDNs into a single project table."""
    try:
        success, message = db.save_campaign_targets_project(
            request.msisdn_list, 
            request.project_name
        )
        if success:
            return {"status": "success", "message": message}
        else:
            raise HTTPException(status_code=500, detail=message)
    except Exception as e:
        print(f"DEBUG: Launch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/log-scrub-entry")
async def log_scrub_entry(request: LogScrubRequest):
    """Logs the scrub statistics explicitly via button click."""
    try:
        success, message = db.log_scrub_history(request.model_dump())
        if success:
            return {"status": "success", "message": message}
        else:
            raise HTTPException(status_code=500, detail=message)
    except Exception as e:
        print(f"DEBUG: Log error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/scrub-history")
async def get_scrub_history():
    """Fetches all scrub history log entries."""
    try:
        entries = db.get_scrub_history()
        # Convert datetime objects to string for JSON serialization
        for entry in entries:
            for k, v in entry.items():
                if hasattr(v, 'isoformat'):
                    entry[k] = v.isoformat()
        return {"status": "success", "data": entries}
    except Exception as e:
        print(f"DEBUG: Fetch history error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/verify-email")
async def verify_email():
    """Diagnostic endpoint to test SMTP connectivity."""
    test_report = {
        "initial_count": 100,
        "dnd_removed": 10,
        "sub_removed": 5,
        "operator_removed": 2,
        "unsub_removed": 3,
        "stages": [{"stage": "Final", "count": 80}]
    }
    success, message = email_module.send_scrub_report(test_report)
    if success:
        return {"status": "success", "message": "Test email sent successfully to " + (email_module.user or "default")}
    else:
        raise HTTPException(status_code=500, detail=f"Email Verification Failed: {message}")

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), account: str = Form("")):
    """Handles MSISDN file uploads with optional account tagging."""
    try:
        content = await file.read()
        extension = os.path.splitext(file.filename)[1]
        msisdns = upload_handler.process_file(content, extension)
        
        # Log upload metadata to database
        if account and db.engine:
            try:
                with db.engine.connect() as conn:
                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS upload_history (
                            id SERIAL PRIMARY KEY,
                            account VARCHAR(100) NOT NULL,
                            filename VARCHAR(255),
                            msisdn_count INT DEFAULT 0,
                            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    """))
                    conn.execute(
                        text("INSERT INTO upload_history (account, filename, msisdn_count) VALUES (:account, :filename, :count)"),
                        {"account": account, "filename": file.filename, "count": len(msisdns)}
                    )
                    conn.commit()
                    print(f"DEBUG: Upload logged for account '{account}': {file.filename} ({len(msisdns)} records)")
            except Exception as db_err:
                print(f"DEBUG: Upload history log warning (non-fatal): {db_err}")

        res_data = {"count": len(msisdns), "msisdns": msisdns, "total": len(msisdns), "account": account}
        print(f"DEBUG: Returning response with total: {res_data['total']}, account: {account}")
        return res_data
    except Exception as e:
        print(f"DEBUG: Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/upload-history")
async def get_upload_history(account: str = None):
    """Fetches upload history, optionally filtered by account."""
    if not db.engine:
        return {"data": []}
    try:
        with db.engine.connect() as conn:
            if account:
                rows = conn.execute(
                    text("SELECT * FROM upload_history WHERE account = :account ORDER BY uploaded_at DESC LIMIT 50"),
                    {"account": account}
                )
            else:
                rows = conn.execute(text("SELECT * FROM upload_history ORDER BY uploaded_at DESC LIMIT 50"))
            data = [dict(r) for r in rows.mappings()]
            for entry in data:
                for k, v in entry.items():
                    if hasattr(v, 'isoformat'):
                        entry[k] = v.isoformat()
            return {"data": data}
    except Exception as e:
        print(f"DEBUG: Upload history error: {e}")
        return {"data": []}

@app.post("/trigger-email-sync")
async def trigger_email_sync():
    """Triggers the email CSV sync agent in a background thread.
    The agent will poll for a new scrub report email for up to 10 minutes.
    """
    def _run_sync():
        agent = EmailCSVAgent()
        result = agent.wait_and_sync(poll_interval=30, max_wait=600)
        if result:
            print(f"✅ EMAIL SYNC COMPLETE: Data saved to table '{result}'")
        else:
            print("⏰ EMAIL SYNC: No new email found.")
    
    thread = threading.Thread(target=_run_sync, daemon=True)
    thread.start()
    return {"status": "started", "message": "Email sync agent started. Polling for 10 minutes..."}

@app.post("/trigger-voip-call")
async def trigger_voip_call(request: VOIPRequest):
    """Triggers a VOIP call via the VOIP module."""
    success, message = voip_module.trigger_call(
        request.msisdn, 
        request.shortcode,
        script=request.script
    )
    if success:
        return {"status": "success", "message": message}
    else:
        raise HTTPException(status_code=500, detail=message)

@app.get("/voip/virtual-calls")
async def get_virtual_calls():
    """Returns active virtual calls for the developer lab."""
    from modules.voip_module import active_virtual_calls
    return {"calls": active_virtual_calls}

@app.post("/voip/virtual-respond")
async def respond_virtual_call(call_id: str = Form(...), action: str = Form(...)):
    """Handles developer interaction (Answer/Hangup) in the Virtual Lab."""
    from modules.voip_module import active_virtual_calls
    if call_id in active_virtual_calls:
        if action == "hangup":
            del active_virtual_calls[call_id]
        else:
            active_virtual_calls[call_id]["status"] = action
        return {"status": "ok"}
    raise HTTPException(status_code=404, detail="Call not found")

@app.post("/generate-flow-json")
async def flow_json_from_doc(request: FlowDocRequest):
    """Generates a React Flow JSON from document text."""
    try:
        flow_str = prompt_agent.generate_flow_json(request.doc_text)
        import json
        return json.loads(flow_str)
    except Exception as e:
        print(f"Error in flow_json_from_doc: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-flow-json-from-xml")
async def flow_json_from_xml(request: FlowXMLRequest):
    """Generates a React Flow JSON from XML content."""
    try:
        flow_str = prompt_agent.generate_flow_json_from_xml(request.xml_content)
        import json
        return json.loads(flow_str)
    except Exception as e:
        print(f"Error in flow_json_from_xml: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-flow-from-doc")
async def flow_from_doc(request: FlowDocRequest):
    """Generates a flow diagram from document text."""
    try:
        flow = prompt_agent.generate_flow_from_doc(request.doc_text)
        return {"flow": flow}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-flow-from-xml")
async def flow_from_xml(request: FlowXMLRequest):
    """Generates a flow diagram from XML content."""
    try:
        flow = prompt_agent.generate_flow_from_xml(request.xml_content)
        return {"flow": flow}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/export-flow-pdf")
async def export_flow_pdf(mermaid_code: str = Form(...), campaign_name: str = Form("AI Campaign")):
    """Exports a mermaid diagram to a branded PDF using Mermaid.ink."""
    try:
        import requests
        import base64
        from fpdf import FPDF
        import tempfile

        # Mermaid code needs to be base64 encoded for mermaid.ink
        # We wrap it in a JSON structure that mermaid.ink expects for the /img/ endpoint optionally, 
        # but the simple base64 of the string also works for many diagrams.
        graph_bytes = mermaid_code.encode("utf-8")
        base64_graph = base64.b64encode(graph_bytes).decode("utf-8")
        image_url = f"https://mermaid.ink/img/{base64_graph}"
        
        # Download image
        response = requests.get(image_url)
        if response.status_code != 200:
            # Fallback: try with dark theme if default fails or looks bad
            image_url += "?theme=dark"
            response = requests.get(image_url)
            if response.status_code != 200:
                raise Exception("Failed to generate diagram image from Mermaid.ink. Please check if your diagram code is valid.")
            
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp_img:
            tmp_img.write(response.content)
            img_path = tmp_img.name
            
        # Create PDF
        pdf = FPDF()
        pdf.add_page()
        
        # Branding Header
        pdf.set_font("Helvetica", "B", 26)
        pdf.set_text_color(225, 29, 72) # Rose color
        pdf.cell(0, 25, "OUTSMART GLOBAL", ln=True, align="C")
        
        pdf.set_font("Helvetica", "B", 18)
        pdf.set_text_color(15, 23, 42) # Dark Slate
        pdf.cell(0, 10, "AI CAMPAIGN STUDIO", ln=True, align="C")
        
        pdf.ln(5)
        pdf.set_font("Helvetica", "", 12)
        pdf.set_text_color(100, 116, 139)
        pdf.cell(0, 10, f"Campaign Blueprint: {campaign_name}", ln=True, align="C")
        pdf.ln(10)
        
        # Flow Diagram Image
        # Scaling to fit width while maintaining aspect ratio
        pdf.image(img_path, x=10, y=None, w=190)
        
        # Footer
        pdf.set_y(-30)
        pdf.set_font("Helvetica", "I", 9)
        pdf.set_text_color(148, 163, 184)
        pdf.cell(0, 10, "CONFIDENTIAL - Generated by Outsmart AI Agent", ln=0, align="L")
        pdf.cell(0, 10, f"Generated on: {os.popen('date').read().strip()}", ln=0, align="R")
        
        pdf_bytes = pdf.output()
        
        # Cleanup
        os.remove(img_path)
        
        from fastapi.responses import Response
        return Response(content=pdf_bytes, media_type="application/pdf", headers={
            "Content-Disposition": f"attachment; filename=campaign_flow_{campaign_name.replace(' ', '_')}.pdf"
        })
        
    except Exception as e:
        print(f"PDF Export Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-content")
async def generate_content(request: ProcessRequest):
    """Generates OBD prompts and flow diagram."""
    context = request.email_context or "Standard promotional campaign"
    prompts = prompt_agent.generate_prompts(context)
    flow = prompt_agent.generate_flow_mermaid(context)
    return {"prompts": prompts, "flow": flow}

@app.get("/db-stats")
async def get_db_stats():
    """Returns counts with Cache integration to avoid overloading."""
    from modules.cache_engine import cache_engine
    cached_stats = cache_engine.get("db_stats")
    if cached_stats:
        return cached_stats

    if not db.engine:
        return {"dnd_count": "DB_NOT_INIT", "sub_count": "DB_NOT_INIT", "unsub_count": "DB_NOT_INIT"}
        
    try:
        with db.engine.connect() as conn:
            dnd_res = conn.execute(text("SELECT COUNT(*) AS cnt FROM dnd_list")).mappings().first()
            sub_res = conn.execute(text("SELECT COUNT(*) AS cnt FROM subscriptions WHERE status = 'ACTIVE'")).mappings().first()
            unsub_res = conn.execute(text("SELECT COUNT(*) AS cnt FROM unsubscriptions")).mappings().first()
            
            stats = {
                "dnd_count": dnd_res['cnt'] if dnd_res else 0,
                "sub_count": sub_res['cnt'] if sub_res else 0,
                "unsub_count": unsub_res['cnt'] if unsub_res else 0,
            }
            # Cache for 5 minutes
            cache_engine.set("db_stats", stats, expire=300)
            return stats
    except Exception as e:
        print(f"DB Stats Error: {e}")
        return {"dnd_count": f"ERR: {str(e)}", "sub_count": "ERR", "unsub_count": "ERR"}

@app.post("/schedule-promotion")
async def schedule_promotion(request: ScheduleRequest):
    """Saves scheduling details for a promotion."""
    try:
        success = db.save_scheduling_details(request.model_dump())
        if success:
            return {"status": "success", "message": "Promotion scheduled successfully"}
        else:
            error_msg = getattr(db, 'last_error', 'Unknown database error')
            raise HTTPException(status_code=500, detail=error_msg)
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health-check")
async def health_check():
    """Monitors the current promotion health and database connectivity."""
    db_status = "Disconnected"
    db_host = "N/A"
    try:
        if db.engine:
            with db.engine.connect() as conn:
                db_status = "Connected"
                # Extract host safely for diagnostic display
                db_host = str(db.engine.url.host) if db.engine.url else "unknown"
    except Exception as e:
        db_status = f"Error: {str(e)}"

    mock_stats = {"success_rate": 0.45, "unsub_rate": 0.01}
    alerts = alerting_system.check_promotion_health(mock_stats)
    return {
        "status": "Monitoring", 
        "database": db_status,
        "ai_engine": "Online" if prompt_agent.model else "Offline",
        "connected_to": db_host,
        "database_type": db.db_type,
        "alerts": alerts
    }

# --- Logging Dashboard API ---
@app.get("/logs")
async def get_logs(category: str = None, since_id: int = 0):
    """Returns logs, optionally filtered by category. Supports polling via since_id."""
    return {
        "logs": logger.get_logs(category=category, since_id=since_id),
        "stats": logger.get_stats()
    }

@app.post("/logs/clear")
async def clear_logs(category: str = None):
    """Clears logs, optionally for a specific category."""
    logger.clear(category)
    return {"status": "cleared", "category": category or "all"}

@app.post("/logs/add")
async def add_frontend_log(level: str = Form("info"), message: str = Form(...)):
    """Allows the frontend to push its own logs."""
    logger.log("frontend", level, message, "browser")
    return {"status": "logged"}

@app.get("/logging-dashboard", response_class=HTMLResponse)
async def logging_dashboard():
    """Serves the logging dashboard."""
    dashboard_path = os.path.join(os.path.dirname(__file__), "static", "logging_dashboard.html")
    if os.path.exists(dashboard_path):
        with open(dashboard_path, "r") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>Dashboard not found</h1>", status_code=404)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
