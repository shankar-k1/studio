from fastapi import FastAPI, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy import text
from pydantic import BaseModel
from typing import List, Optional, Dict
from modules.email_module import EmailModule
from modules.scrubbing_engine import ScrubbingEngine
from modules.alerting_system import AlertingSystem
from modules.upload_handler import UploadHandler
from modules.database_module import DatabaseModule
from agents.obd_prompt_agent import OBDPromptAgent
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(title="Outsmart OBD Agent API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Modules
email_module = EmailModule()
scrubbing_engine = ScrubbingEngine()
alerting_system = AlertingSystem()
upload_handler = UploadHandler()
prompt_agent = OBDPromptAgent()
db = DatabaseModule()

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

class LogScrubRequest(BaseModel):
    total_input: int
    final_count: int
    dnd_removed: int
    sub_removed: int
    unsub_removed: int
    operator_removed: int
    msisdn_list: List[str] = []

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
        # A simple token for frontend session management
        return {"status": "success", "token": "obd_auth_token_secret_123"}
    raise HTTPException(status_code=401, detail="Invalid username or password")

@app.post("/create-user")
async def create_user(request: LoginRequest):
    if db.create_admin_user(request.username, request.password):
        return {"status": "success", "message": f"User {request.username} successfully created in database"}
    raise HTTPException(status_code=500, detail="Failed to create user or user already exists")

@app.post("/scrub")
async def scrub_base(request: ProcessRequest, background_tasks: BackgroundTasks):
    """Performs scrubbing on the provided MSISDN list with specific options."""
    try:
        final_base, report = scrubbing_engine.perform_full_scrub(
            request.msisdn_list, 
            request.operator, 
            request.options
        )
        
        # Consolidate background tasks for better logging/monitoring
        if final_base:
            background_tasks.add_task(post_scrub_processing, final_base, report)

        print(f"DEBUG: Scrub complete. Final count: {len(final_base)}. Post-processing queued.")
        return {
            "final_base_count": len(final_base), 
            "final_base": final_base, 
            "report": report,
            "tasks_status": "QUEUED"
        }
    except Exception as e:
        print(f"DEBUG: Scrub error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def post_scrub_processing(final_base, report):
    """Heavy I/O tasks run in background to prevent UI timeouts."""
    import time
    start_time = time.time()
    print("--- STARTING POST-SCRUB BACKGROUND PROCESSING ---")
    
    # 1. Save to Database FIRST (So UI has immediate access to results)
    table_name = "NONE"
    try:
        print(f"DEBUG: Saving {len(final_base)} targets to database...")
        db_start = time.time()
        save_ok, table_name = db.save_verified_scrub_results(final_base)
        duration = time.time() - db_start
        print(f"DEBUG: DB Save Status: {'SUCCESS (' + table_name + ')' if save_ok else 'FAILED'} (Took {duration:.2f}s)")
    except Exception as e:
        print(f"ERROR: Background DB save failed: {e}")

    # 2. Email Report SECOND (Subject to network firewalls/timeouts)
    try:
        print(f"DEBUG: Sending scrubbing report via email...")
        email_ok, email_msg = email_module.send_scrub_report(report, msisdns=final_base)
        print(f"DEBUG: Email Status: {'SENT' if email_ok else 'FAILED: ' + email_msg}")
    except Exception as e:
        print(f"ERROR: Background email failed: {e}")
        
    print(f"--- COMPLETED POST-SCRUB BACKGROUND PROCESSING (Total: {time.time() - start_time:.2f}s) ---")

class LaunchRequest(BaseModel):
    msisdn_list: List[str]
    project_name: str = "default"

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
async def upload_file(file: UploadFile = File(...)):
    """Handles MSISDN file uploads."""
    try:
        content = await file.read()
        extension = os.path.splitext(file.filename)[1]
        msisdns = upload_handler.process_file(content, extension)
        res_data = {"count": len(msisdns), "msisdns": msisdns, "total": len(msisdns)}
        print(f"DEBUG: Returning response with total: {res_data['total']}")
        return res_data
    except Exception as e:
        print(f"DEBUG: Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-flow-from-doc")
async def flow_from_doc(doc_text: str = Form(...)):
    """Generates a flow diagram from document text."""
    try:
        flow = prompt_agent.generate_flow_from_doc(doc_text)
        return {"flow": flow}
    except Exception as e:
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
    """Returns counts for DnD list, subscriptions, and unsubscriptions."""
    if not db.engine:
        return {"dnd_count": "DB_NOT_INIT", "sub_count": "DB_NOT_INIT", "unsub_count": "DB_NOT_INIT"}
        
    try:
        # Check connection explicitly
        with db.engine.connect() as conn:
            dnd_res = conn.execute(text("SELECT COUNT(*) AS cnt FROM dnd_list")).mappings().first()
            sub_res = conn.execute(text("SELECT COUNT(*) AS cnt FROM subscriptions WHERE status = 'ACTIVE'")).mappings().first()
            unsub_res = conn.execute(text("SELECT COUNT(*) AS cnt FROM unsubscriptions")).mappings().first()
            
            return {
                "dnd_count": dnd_res['cnt'] if dnd_res else 0,
                "sub_count": sub_res['cnt'] if sub_res else 0,
                "unsub_count": unsub_res['cnt'] if unsub_res else 0,
            }
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
        "connected_to": db_host,
        "database_type": db.db_type,
        "alerts": alerts
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
