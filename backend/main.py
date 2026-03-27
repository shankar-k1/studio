import os
import json
import jwt
import uvicorn
import datetime
from datetime import timedelta
import threading
from typing import List, Optional, Dict
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

# Import internal modules (Ensure these exist in your project structure)
try:
    from modules.database_module import DatabaseModule
    from modules.upload_handler import UploadHandler
    from modules.scrubbing_engine import ScrubbingEngine
    from agents.obd_prompt_agent import OBDPromptAgent
except ImportError:
    # Fallback for folder structure variations
    from .modules.database_module import DatabaseModule
    from .modules.upload_handler import UploadHandler
    from .modules.scrubbing_engine import ScrubbingEngine
    from .agents.obd_prompt_agent import OBDPromptAgent

# VOIP Imports
try:
    from modules.voip_module import voip_module, active_virtual_calls
except ImportError:
    from .modules.voip_module import voip_module, active_virtual_calls

# --- CONFIGURATION ---
JWT_SECRET = os.getenv("JWT_SECRET", "super_secret_key_123")
JWT_ALGORITHM = "HS256"
JWT_EXP_SECONDS = 86400  # 24 Hours

# --- SHARED INSTANCES ---
db = DatabaseModule()
upload_handler = UploadHandler()
scrubbing_engine = ScrubbingEngine()
prompt_agent = OBDPromptAgent()

# --- LIFESPAN MANAGER ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handles startup and shutdown of background tasks."""
    print("🚀 Starting Mobicom OBD Backend with Multi-Worker Support...")
    
    # Start the background ScrubWorker
    # Note: In multi-worker mode, this runs once PER worker process.
    # Shared state is managed via DiskCache/Database.
    try:
        from modules.scrub_worker import run_forever
    except ImportError:
        from .modules.scrub_worker import run_forever
        
    worker_thread = threading.Thread(
        target=run_forever, 
        kwargs={"poll_interval": 2}, 
        daemon=True
    )
    worker_thread.start()
    print("🔩 Background ScrubWorker started in this process.")
    
    yield
    print("🛑 Shutting down process...")

# --- APP INITIALIZATION ---
app = FastAPI(title="Mobicom OBD Platform", lifespan=lifespan)

# --- MIDDLEWARE ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- AUTHENTICATION HELPERS ---
def create_token(username: str) -> str:
    payload = {
        "sub": username,
        "exp": datetime.datetime.utcnow() + timedelta(seconds=JWT_EXP_SECONDS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except:
        raise HTTPException(status_code=401, detail="Invalid session")

# --- AUTH ENDPOINTS ---
@app.post("/login")
async def login(data: dict):
    username = data.get("username")
    password = data.get("password")
    if username == "admin" and password == "admin": 
        return {"token": create_token(username)}
    raise HTTPException(status_code=401, detail="Invalid credentials")

# --- API ENDPOINTS ---
@app.get("/api/health")
async def health():
    return {"status": "ok", "deployment": "production", "workers": 4}

@app.get("/api/db-stats")
async def get_stats():
    return db.get_db_stats()

@app.get("/api/ai-status")
async def get_ai_status():
    return prompt_agent.get_status()

@app.get("/settings")
async def get_settings(user: str = Depends(get_current_user)):
    keys = ["LLM_API_KEY", "VOIP_MODE", "SIP_HOST", "SIP_PORT", "SIP_USER", "SIP_PASS", "DEEPGRAM_API_KEY", "ELEVENLABS_API_KEY"]
    results = {}
    for k in keys:
        results[k] = db.get_setting(k, os.getenv(k, ""))
    return results

@app.post("/settings")
async def update_settings(data: Dict[str, str], user: str = Depends(get_current_user)):
    for k, v in data.items():
        db.update_setting(k, v)
    return {"message": "Settings updated"}

@app.get("/vocal-sync/history")
async def get_vs_history(user: str = Depends(get_current_user)):
    return {"history": db.get_vocal_sync_history()}

@app.post("/vocal-sync/history")
async def add_vs_history(data: Dict, user: str = Depends(get_current_user)):
    db.add_vocal_sync_history(
        filename=data.get("fileName"),
        original_text=data.get("originalText"),
        translated_text=data.get("translatedText"),
        source_lang=data.get("detectedLang"),
        target_lang=data.get("targetLang"),
        output_url=data.get("outputUrl"),
        metadata_json=json.dumps(data.get("metadata", {}))
    )
    return {"status": "success"}

@app.get("/auth/me")
async def auth_me(user: str = Depends(get_current_user)):
    return {"username": user, "role": "ADMIN"}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), user: str = Depends(get_current_user)):
    return await upload_handler.handle_upload(file)

@app.post("/scrub")
async def start_scrub(data: dict, user: str = Depends(get_current_user)):
    msisdn_list = data.get("msisdn_list", [])
    options = data.get("options", {})
    return scrubbing_engine.enqueue_job(msisdn_list, options)

@app.get("/scrub-job/{job_id}")
async def get_job(job_id: int):
    job = db.get_scrub_job(job_id)
    return {"job": job}

@app.post("/generate-flow-json")
async def generate_flow(data: dict, user: str = Depends(get_current_user)):
    doc_text = data.get("doc_text")
    return await prompt_agent.generate_flow(doc_text)

@app.post("/generate-flow-explanation")
async def generate_explanation(data: dict, user: str = Depends(get_current_user)):
    xml_content = data.get("xml_content")
    if not xml_content:
        raise HTTPException(status_code=400, detail="Missing xml_content")
    return {"explanation": await prompt_agent.generate_plain_description_from_xml(xml_content)}

@app.post("/explain-flow")
async def explain_flow(data: dict, user: str = Depends(get_current_user)):
    message = data.get("message")
    system = data.get("system")
    prompt = f"{system}\n\n{message}"
    return {"explanation": await prompt_agent._generate(prompt)}

# --- FLOW STORAGE ENDPOINTS ---
@app.get("/api/flows")
async def get_flows(user: str = Depends(get_current_user)):
    return db.get_flows()

@app.get("/api/flows/{uuid}")
async def get_flow(uuid: str, user: str = Depends(get_current_user)):
    flow = db.get_flow(uuid)
    if not flow: raise HTTPException(status_code=404, detail="Flow not found")
    return flow

@app.post("/api/flows")
async def save_flow(data: dict, user: str = Depends(get_current_user)):
    success, result = db.save_flow(data)
    if not success: raise HTTPException(status_code=500, detail=result)
    return {"status": "success", "uuid": result if isinstance(result, str) else data.get("uuid")}

@app.delete("/api/flows/{uuid}")
async def delete_flow(uuid: str, user: str = Depends(get_current_user)):
    if db.delete_flow(uuid): return {"status": "deleted"}
    raise HTTPException(status_code=500, detail="Failed to delete")

@app.post("/api/flows/{uuid}/explanation")
async def save_explanation(uuid: str, data: dict, user: str = Depends(get_current_user)):
    sections = data.get("sections", [])
    if db.save_explanation(uuid, sections): return {"status": "saved"}
    raise HTTPException(status_code=500, detail="Failed to save explanation")

@app.get("/api/flows/{uuid}/explanation")
async def get_explanation(uuid: str, user: str = Depends(get_current_user)):
    return {"sections": db.get_explanation(uuid)}

# --- VOIP ENDPOINTS ---
@app.post("/trigger-voip-call")
async def trigger_voip_call(data: dict, user: str = Depends(get_current_user)):
    msisdn = data.get("msisdn")
    shortcode = data.get("shortcode", "5566")
    script = data.get("script", "Hello from Mobicom Global OBD platform.")
    success, message = voip_module.trigger_call(msisdn, shortcode, script)
    if not success:
        raise HTTPException(status_code=500, detail=message)
    return {"message": message}

@app.get("/voip/virtual-calls")
async def get_virtual_calls():
    return {"calls": active_virtual_calls}

@app.post("/voip/virtual-respond")
async def virtual_respond(call_id: str = Form(...), action: str = Form(...)):
    if call_id in active_virtual_calls:
        if action == "answered":
            active_virtual_calls[call_id]["status"] = "active"
        elif action == "hangup":
            del active_virtual_calls[call_id]
        return {"status": "ok"}
    raise HTTPException(status_code=404, detail="Call not found")

@app.post("/voip/stop-calls")
async def stop_virtual_calls():
    # Only available in 'virtual' mode for safety
    if os.getenv("VOIP_MODE", "virtual") == "virtual":
        active_virtual_calls.clear()
        return {"message": "All virtual call sessions terminated."}
    return {"message": "Stop command only supported in virtual mode."}

# --- STATIC ASSETS & FRONTEND ---
# 1. Mount /static for HTML files in backend/static
static_assets_path = os.path.join(os.getcwd(), "static")
if os.path.exists(static_assets_path):
    app.mount("/static", StaticFiles(directory=static_assets_path), name="static")

# 2. Mount / for the React/NextJS frontend
frontend_path = os.path.join(os.getcwd(), "..", "frontend", "out")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="ui")
else:
    @app.get("/")
    async def root_fallback():
        return {"message": "Frontend not found. Use /static/scp_dashboard.html for the fallback dashboard."}

# --- MAIN ENTRY POINT ---
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, workers=4, reload=False)
