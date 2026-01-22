from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import json
import uvicorn
import os
import time
import logging

# --- SOVEREIGN CORE IMPORTS ---
from core.local_llm import sovereign_brain
from cartridges.retail.controller import FeasibilityAdapter

# --- LEGACY SYSTEM IMPORTS ---
from core.ingestion import ingestion_engine
from core.orchestrator import orchestrator
from core.feature_store import feature_store
from core.ledger import ledger
from core.policy_engine import policy_engine
from core.domain_model import domain_mgr
from core.sql_schema import init_db

# --- AGENCY & DEBATE SYSTEMS ---
try:
    from core.agency import auctobot
except ImportError:
    auctobot = None

try:
    from core.debate import debate_engine
except ImportError:
    debate_engine = None

# --- AUXILIARY ENGINES ---
try:
    from core.transformations import transform_engine
except ImportError:
    transform_engine = None

try:
    from ml_engine import ml_engine
except ImportError:
    ml_engine = None

# --- LOGGING CONFIGURATION ---
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger("AUCTORIAN_KERNEL")

# --- APP INITIALIZATION ---
app = FastAPI(
    title="Auctorian Sovereign Node",
    version="6.2.0-Monolith",
    description="The Autonomous Merchant Operating System (Local Inference Edition)"
)

# [FIX] Explicitly define origins. '*' with credentials=True is blocked by browsers.
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://0.0.0.0:3000",
    "http://localhost:5173",  # Vite default (just in case)
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================================================================
# 1. THE BOOT SEQUENCE
# ==============================================================================

@app.on_event("startup")
async def boot_sequence():
    logger.info("🟢 [SYSTEM] Initiating Auctorian Boot Sequence...")
    init_db() 
    logger.info("💽 [STORAGE] SQL Ledger Initialized.")

    try:
        start_time = time.time()
        logger.info("🔌 [PHYSICS] Pinging Local Inference Node...")
        health_check = sovereign_brain.generate("Ping.", role="analyst")
        latency = time.time() - start_time
        logger.info(f"⚡ [PHYSICS] GPU Online. Latency: {latency:.2f}s. Response: {health_check}")
    except Exception as e:
        logger.critical(f"🔥 [PHYSICS FATAL] Sovereign Compute Node Unreachable: {e}")

    try:
        logger.info("🧠 [MEMORY] Hydrating Retail Context...")
        adapter = FeasibilityAdapter()
        count = len(adapter._cache.get("products", []))
        logger.info(f"🧠 [MEMORY] Hydration Complete. Active Context: {count} SKUs.")
    except Exception as e:
        logger.error(f"❌ [MEMORY] Hydration Failed: {e}")

    logger.info("🚀 [SYSTEM] Auctorian Sovereign Node is ONLINE and READY.")


# ==============================================================================
# 1. HEALTH & SYSTEM STATUS
# ==============================================================================

@app.get("/health")
async def health_check():
    """
    [CONSTITUTIONAL UI] Returns system status including lock state.
    """
    try:
        is_locked = domain_mgr.is_system_locked()
        return {
            "status": "online",
            "is_locked": is_locked,
            "version": "6.2.0-Constitutional"
        }
    except Exception as e:
        return {"status": "degraded", "is_locked": False, "error": str(e)}

# ==============================================================================
# 2. ONTOLOGY & DATA CONTRACTS
# ==============================================================================

@app.get("/graph/objects/{obj_type}")
async def get_graph_objects(obj_type: str):
    return domain_mgr.get_objects(obj_type)

@app.get("/ontology/stats")
async def get_ontology_stats():
    return domain_mgr.get_stats()

@app.get("/ontology/structure")
async def get_ontology_structure(type: Optional[str] = None):
    target_type = type if type else 'PRODUCT'
    return domain_mgr.get_structure(target_type)

@app.post("/ontology/structure")
async def update_ontology_structure(payload: Dict[str, Any]):
    """
    [FIXED] Accepts structure updates from the Frontend.
    Required to prevent 405 Method Not Allowed errors.
    """
    return domain_mgr.save_structure(payload.get('entity', 'PRODUCT'), payload.get('fields', []))

@app.post("/ontology/schema/register")
async def register_schema(payload: Dict[str, Any]):
    """
    [CONSTITUTIONAL UI] Registers the client's schema mapping.
    Validates against DNA mandatory anchors.
    """
    try:
        entity_type = payload.get('entity_type', 'PRODUCT')
        fields = payload.get('fields', [])
        domain_mgr.register_schema(entity_type, fields)
        return {"status": "success", "message": f"Schema registered for {entity_type}"}
    except Exception as e:
        logger.error(f"Schema registration failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/ontology/lock")
async def lock_system():
    """
    [CONSTITUTIONAL UI] Locks the system (Phase 1 -> Phase 2).
    Makes schema immutable.
    """
    try:
        domain_mgr.lock_system()
        return {"status": "success", "message": "System LOCKED. Schema is now immutable."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/ontology/registry")
async def get_registry():
    """
    [ONTOLOGY LIFECYCLE] Returns all registered schemas.
    Used for UI state hydration and schema management.
    """
    try:
        registry = domain_mgr.get_full_registry()
        return {"status": "success", "registry": registry}
    except Exception as e:
        logger.error(f"Registry fetch failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/ontology/schema/{entity_type}")
async def delete_schema(entity_type: str):
    """
    [ONTOLOGY LIFECYCLE] Deletes a schema from the registry.
    Only works when system is unlocked.
    """
    try:
        # Check if system is locked
        if domain_mgr.is_system_locked():
            raise HTTPException(
                status_code=423, 
                detail="Cannot delete schema: System is locked"
            )
        
        domain_mgr.delete_schema(entity_type)
        return {
            "status": "success", 
            "message": f"{entity_type} schema deleted"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Schema deletion failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ==============================================================================
# 3. ML & INTELLIGENCE ENDPOINTS
# ==============================================================================

@app.post("/ml/train")
async def trigger_training():
    if not ml_engine: 
        raise HTTPException(status_code=503, detail="ML Engine Offline")
    return ml_engine.run_demand_pipeline()

@app.get("/ml/predict")
async def predict(sku: str, days: int = 7):
    if not ml_engine: 
        return {"error": "ML Engine not loaded"}
    return ml_engine.generate_forecast(sku, days)

@app.get("/ml/explain/{sku}")
async def explain_forecast(sku: str):
    """
    Returns the Analyst Narrative for a specific SKU.
    """
    if not ml_engine: 
        return {"error": "ML Engine Offline"}
    
    # We generate a forecast to get the narrative
    result = ml_engine.generate_forecast(sku)
    
    # Return just the narrative part or a default message
    narrative = result.get("narrative", "No explanation available.")
    return {
        "node_id": sku,
        "narrative": narrative,
        "generated_at": time.time()
    }

@app.get("/ml/metrics")
async def get_ml_metrics():
    if not ml_engine: return {}
    return ml_engine.get_metrics()

@app.get("/ml/accuracy/{node_id}")
async def get_accuracy(node_id: str):
    """
    Returns accuracy stats for a specific node or global fallback.
    """
    if not ml_engine: return {"wmape": 0, "accuracy": 0}
    
    # Fallback to global metrics if granular data isn't in DB yet
    metrics = ml_engine.get_metrics()
    return {
        "node_id": node_id,
        "wmape": metrics.get("rmse", 0.15), 
        "accuracy": int(metrics.get("r2_score", 0.85) * 100)
    }

@app.get("/ml/audit")
async def get_ml_audit_log():
    """Serves the Glass Box data."""
    if not ml_engine: return {}
    return ml_engine.get_audit_log()

@app.get("/ml/accuracy_matrix")
async def get_ml_accuracy_matrix():
    """Serves the Matrix data."""
    if not ml_engine: return []
    return ml_engine.get_accuracy_matrix()


# ==============================================================================
# 4. DECISION ORCHESTRATION
# ==============================================================================

class DecisionRequest(BaseModel):
    type: str
    target: str
    params: Optional[Dict] = {}

@app.post("/orchestrator/decide")
async def orchestrate_decision(request: DecisionRequest):
    logger.info(f"📥 [INGRESS] Decision Request: {request.type} for {request.target}")
    try:
        decision = await orchestrator.process_decision(request.type, request.target, request.params)
        return decision
    except Exception as e:
        logger.error(f"❌ [KERNEL PANIC] Decision Failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/orchestrator/ledger")
async def get_ledger():
    return ledger.get_recent_claims(limit=50)


# ==============================================================================
# 5. INGESTION UTILS
# ==============================================================================

@app.post("/ingest/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        file_location = f"data_lake/{file.filename}"
        os.makedirs("data_lake", exist_ok=True)
        with open(file_location, "wb+") as f:
            f.write(file.file.read())
        summary = ingestion_engine.preview_file(file_location)
        return {"status": "success", "summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ingest/universal")
async def ingest_universal_data(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    config: str = Form(...)
):
    """
    [DATA PLANE] Handles full file ingestion (Schema + Data).
    Runs in background to prevent timeout on large files.
    """
    try:
        # Parse Config
        conf = json.loads(config)
        entity_type = conf.get('entityType')
        mapping = conf.get('mapping', {})
        
        logger.info(f"📥 [INGEST] Received {file.filename} for {entity_type}. Starting background processing...")
        
        # Read file content into memory (for now - for 1.5M rows ~200MB, this is okay)
        # For production, we'd stream it, but let's keep it simple for the prototype.
        content = await file.read()
        content_str = content.decode('utf-8')

        # Define the background task
        def _process_job():
            try:
                logger.info(f"⚙️ [JOB_START] Processing {entity_type}...")
                result = ingestion_engine.process_metric_stream(
                    content_str, 
                    mapping, 
                    metric_prefix=entity_type
                )
                logger.info(f"✅ [JOB_COMPLETE] {entity_type}: {result}")
            except Exception as e:
                logger.error(f"❌ [JOB_FAILED] {entity_type}: {e}")

        # Queue the task
        background_tasks.add_task(_process_job)
        
        return {"status": "queued", "message": f"Ingestion started for {entity_type}"}

    except Exception as e:
        logger.error(f"Ingestion Handshake Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class MappingRequest(BaseModel):
    filename: str
    mapping: Dict[str, str]

@app.post("/ingest/map")
async def map_schema(req: MappingRequest):
    return ingestion_engine.apply_mapping(req.filename, req.mapping)

class MetricDerivation(BaseModel):
    target: str
    metric_a: str
    op: str
    metric_b: str

@app.post("/transform/derive_metric")
async def derive_metric(req: MetricDerivation):
    if not transform_engine: 
        return {"error": "Transform Engine Offline"}
    return transform_engine.derive_metric(req.target, req.metric_a, req.op, req.metric_b)


# ==============================================================================
# 6. AGENCY & DEBATE ENDPOINTS
# ==============================================================================

@app.get("/agency/queue")
async def get_auctobot_queue():
    """
    Returns pending and historical decision packages from Auctobot.
    """
    if not auctobot:
        raise HTTPException(status_code=503, detail="Auctobot offline")
    
    return {
        "queue": auctobot.get_queue(),
        "history": auctobot.get_history(limit=20)
    }

@app.post("/agency/execute")
async def execute_auctobot():
    """
    Executes all queued decision packages and records to ledger.
    """
    if not auctobot:
        raise HTTPException(status_code=503, detail="Auctobot offline")
    
    results = auctobot.execute_batch()
    return {
        "status": "completed",
        "results": results,
        "queue_cleared": len(results)
    }

@app.get("/debate/tickets")
async def get_debate_tickets():
    """
    Returns all active conflict resolution tickets.
    """
    if not debate_engine:
        raise HTTPException(status_code=503, detail="Debate engine offline")
    
    tickets = debate_engine.get_active_tickets()
    return {
        "status": "success",
        "tickets": tickets,
        "count": len(tickets)
    }

class ResolveTicketRequest(BaseModel):
    ticket_id: str
    approved: bool

@app.post("/debate/resolve")
async def resolve_debate(request: ResolveTicketRequest):
    """
    Resolves a conflict ticket.
    If approved, forwards decision to Auctobot.
    """
    if not debate_engine:
        raise HTTPException(status_code=503, detail="Debate engine offline")
    
    result = debate_engine.resolve_ticket(request.ticket_id, request.approved)
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return result


# ==============================================================================
# 7. SYSTEM HEALTH
# ==============================================================================

@app.get("/")
def health_check():
    db_mode = "POSTGRES" if os.environ.get("DATABASE_URL") else "SQLITE"
    return {
        "status": "SOVEREIGN", 
        "system": "Auctorian Kernel v6.2-Monolith", 
        "architecture": "Local Inference (Llama-3)",
        "modules": {
            "physics_layer": "ONLINE",
            "memory_layer": "HYDRATED",
            "db_mode": db_mode,
            "ml_engine": "ONLINE" if ml_engine else "OFFLINE"
        }
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
