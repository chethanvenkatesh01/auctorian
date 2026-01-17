import os
import logging
import json

# --- LOGGING CONFIGURATION ---
logger = logging.getLogger("SQL_SCHEMA")

# --- DATABASE DRIVER LOADING ---
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    POSTGRES_AVAILABLE = True
except ImportError:
    POSTGRES_AVAILABLE = False
    import sqlite3

# --- GLOBAL CONFIG ---
# If this Env Var is set (by Docker), we use Postgres. Otherwise, SQLite.
DATABASE_URL = os.environ.get("DATABASE_URL")

INIT_STMTS = [
    # =========================================================
    # 1. CORE UNIVERSAL LEDGER (THE SOURCE OF TRUTH)
    # =========================================================
    """
    CREATE TABLE IF NOT EXISTS universal_objects (
        obj_id TEXT PRIMARY KEY,
        obj_type TEXT NOT NULL, 
        name TEXT,
        attributes JSON, 
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS universal_events (
        event_id TEXT PRIMARY KEY,
        primary_target_id TEXT NOT NULL,
        event_type TEXT NOT NULL, 
        value REAL,
        timestamp TIMESTAMP,
        meta JSON, 
        FOREIGN KEY(primary_target_id) REFERENCES universal_objects(obj_id)
    )
    """,
    
    # =========================================================
    # 2. FINANCIAL LEDGER (THE BANK)
    # =========================================================
    """
    CREATE TABLE IF NOT EXISTS ledger_entries (
        entry_id TEXT PRIMARY KEY,
        entity_id TEXT,
        account_type TEXT, 
        amount REAL,
        currency TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        meta JSON
    )
    """,
    
    # =========================================================
    # 3. GOVERNANCE (THE LAW)
    # =========================================================
    """
    CREATE TABLE IF NOT EXISTS policy_store (
        policy_key TEXT PRIMARY KEY, 
        entity_id TEXT, 
        value REAL,
        config JSON,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,

    # =========================================================
    # 4. INTELLIGENCE PLANE (THE BRAIN)
    # =========================================================
    """
    CREATE TABLE IF NOT EXISTS demand_hypercube (
        id TEXT PRIMARY KEY,
        sku_id TEXT NOT NULL,
        week_start_date TEXT NOT NULL, 
        run_id TEXT, 
        model_used TEXT, 
        confidence_score REAL, 
        base_demand INTEGER, 
        elasticity_coeff REAL, 
        elasticity_vector JSON, 
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(sku_id) REFERENCES universal_objects(obj_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS forecast_audit_log (
        audit_id TEXT PRIMARY KEY,
        sku_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_quality_score REAL,
        cleansing_log JSON,
        feature_manifest JSON,
        tournament_results JSON,
        driver_importance JSON,
        FOREIGN KEY(sku_id) REFERENCES universal_objects(obj_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS forecast_snapshots (
        snapshot_id TEXT PRIMARY KEY,
        sku_id TEXT NOT NULL,
        target_date TEXT NOT NULL, 
        generated_at TEXT NOT NULL, 
        lag_weeks INTEGER, 
        forecast_qty INTEGER,
        FOREIGN KEY(sku_id) REFERENCES universal_objects(obj_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS accuracy_matrix (
        node_id TEXT, 
        lag_bucket TEXT, 
        wmape_score REAL, 
        bias_score REAL, 
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (node_id, lag_bucket)
    )
    """,
    
    # =========================================================
    # 5. PLANNING PLANE (THE HUMAN LAYER)
    # =========================================================
    """
    CREATE TABLE IF NOT EXISTS plan_overrides (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        period_id TEXT NOT NULL,
        user_adjustment_pct REAL,
        user_adjustment_qty INTEGER,
        rationale TEXT,
        user_id TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """
]

# --- SHARED UTILITIES ---

def get_db_connection(db_path="ados_ledger.db"):
    """
    Universal Connection Factory.
    Returns a Postgres connection if DATABASE_URL is set, else SQLite.
    """
    if DATABASE_URL and POSTGRES_AVAILABLE:
        try:
            conn = psycopg2.connect(DATABASE_URL)
            return conn
        except Exception as e:
            logger.error(f"Postgres Connection Failed: {e}. Falling back to SQLite.")
    
    # Fallback to SQLite
    import sqlite3
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def get_placeholder():
    """Returns '%s' for Postgres or '?' for SQLite"""
    return "%s" if (DATABASE_URL and POSTGRES_AVAILABLE) else "?"

def init_db(db_path="ados_ledger.db"):
    """
    Initializes the database with the full Auctorian Schema.
    Now supports both Postgres and SQLite.
    """
    conn = get_db_connection(db_path)
    
    try:
        if DATABASE_URL and POSTGRES_AVAILABLE:
            # Postgres Logic
            with conn.cursor() as cur:
                for stmt in INIT_STMTS:
                    # Postgres doesn't strictly need JSON type mapping for table creation
                    # as long as we use standard SQL.
                    cur.execute(stmt)
            conn.commit()
            logger.info(f"✅ [STORAGE] Postgres Schema Initialized via DATABASE_URL.")
        else:
            # SQLite Logic
            for stmt in INIT_STMTS:
                try:
                    conn.execute(stmt)
                except Exception as e:
                    logger.warning(f"⚠️ Schema Warning: {e}")
            conn.commit()
            logger.info(f"✅ [STORAGE] SQLite Schema Initialized at {db_path}")
            
    except Exception as e:
        logger.error(f"❌ [STORAGE] Schema Init Failed: {e}")
    finally:
        conn.close()
