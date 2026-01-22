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

# =========================================================
# 1. SQLITE SCHEMA (Simple / Dev Mode)
# =========================================================
SQLITE_INIT = [
    # Core Objects
    """
    CREATE TABLE IF NOT EXISTS universal_objects (
        obj_id TEXT PRIMARY KEY,
        obj_type TEXT NOT NULL, 
        name TEXT,
        attributes JSON, 
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    # Core Events
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
    """
]

# =========================================================
# 2. POSTGRES SCHEMA (Enterprise / Partitioned)
# =========================================================
# We use Declarative Partitioning to split data physically while keeping
# logical unity. This allows for infinite scaling.
POSTGRES_INIT = [
    # --- A. OBJECTS (Partitioned by Type) ---
    """
    CREATE TABLE IF NOT EXISTS universal_objects (
        obj_id TEXT NOT NULL,
        obj_type TEXT NOT NULL, 
        name TEXT,
        attributes JSONB, 
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (obj_type, obj_id)
    ) PARTITION BY LIST (obj_type);
    """,
    # Partition 1: Products (Physical Table: objects_product)
    "CREATE TABLE IF NOT EXISTS objects_product PARTITION OF universal_objects FOR VALUES IN ('PRODUCT');",
    # Partition 2: Locations (Physical Table: objects_location)
    "CREATE TABLE IF NOT EXISTS objects_location PARTITION OF universal_objects FOR VALUES IN ('LOCATION');",
    # Partition 3: Customers (Physical Table: objects_customer)
    "CREATE TABLE IF NOT EXISTS objects_customer PARTITION OF universal_objects FOR VALUES IN ('CUSTOMER');",
    # Partition 4: Catch-All (For Suppliers, Competitors, etc)
    "CREATE TABLE IF NOT EXISTS objects_default PARTITION OF universal_objects DEFAULT;",

    # --- B. EVENTS (Partitioned by Type - Optimized for Analytics) ---
    """
    CREATE TABLE IF NOT EXISTS universal_events (
        event_id TEXT NOT NULL,
        primary_target_id TEXT NOT NULL,
        event_type TEXT NOT NULL, 
        value DOUBLE PRECISION,
        timestamp TIMESTAMP,
        meta JSONB,
        PRIMARY KEY (event_type, event_id)
    ) PARTITION BY LIST (event_type);
    """,
    # Partition 1: High Volume Transaction Data (The Big One)
    "CREATE TABLE IF NOT EXISTS events_sales PARTITION OF universal_events FOR VALUES IN ('SALES_QTY');",
    # Partition 2: Inventory Snapshots
    "CREATE TABLE IF NOT EXISTS events_inventory PARTITION OF universal_events FOR VALUES IN ('INV_SNAPSHOT');",
    # Partition 3: Pricing Signals
    "CREATE TABLE IF NOT EXISTS events_pricing PARTITION OF universal_events FOR VALUES IN ('PRICE', 'COMP_PRICE', 'PROMO_FLAG');",
    # Partition 4: Everything Else (Logs, Audits)
    "CREATE TABLE IF NOT EXISTS events_default PARTITION OF universal_events DEFAULT;",
    
    # --- INDICES (Critical for Performance) ---
    "CREATE INDEX IF NOT EXISTS idx_evt_time ON universal_events(timestamp);",
    "CREATE INDEX IF NOT EXISTS idx_evt_target ON universal_events(primary_target_id);"
]

# =========================================================
# 3. COMMON TABLES (Shared across both engines)
# =========================================================
COMMON_INIT = [
    # Metadata: The Schema Registry (Article II & IV Enforcement)
    """
    CREATE TABLE IF NOT EXISTS schema_registry (
        id SERIAL PRIMARY KEY,
        entity_type TEXT NOT NULL, 
        source_column_name TEXT NOT NULL, 
        generic_anchor TEXT, -- Maps to Anchors in dna.py
        family_type TEXT NOT NULL, -- INTRINSIC, STATE, etc.
        is_pk BOOLEAN DEFAULT FALSE,
        is_attribute BOOLEAN DEFAULT TRUE,
        is_hierarchy BOOLEAN DEFAULT FALSE,
        hierarchy_level INTEGER,
        formula TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    # Governance: System Lock
    """
    CREATE TABLE IF NOT EXISTS system_config (
        config_key TEXT PRIMARY KEY,
        config_value TEXT,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    # Financial Ledger
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
    # Governance Policies
    """
    CREATE TABLE IF NOT EXISTS policy_store (
        policy_key TEXT PRIMARY KEY, 
        entity_id TEXT, 
        value REAL,
        config JSON,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    # Intelligence: Demand Hypercube
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    # Intelligence: Audit Log
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
        driver_importance JSON
    )
    """,
    # Intelligence: Snapshots
    """
    CREATE TABLE IF NOT EXISTS forecast_snapshots (
        snapshot_id TEXT PRIMARY KEY,
        sku_id TEXT NOT NULL,
        target_date TEXT NOT NULL, 
        generated_at TEXT NOT NULL, 
        lag_weeks INTEGER, 
        forecast_qty INTEGER
    )
    """,
    # Intelligence: Accuracy Matrix
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
    # Debate: Conflict Resolution Tickets
    """
    CREATE TABLE IF NOT EXISTS debate_tickets (
        ticket_id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL,
        issue_type TEXT NOT NULL,
        value REAL,
        threshold REAL,
        reason TEXT,
        status TEXT DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP,
        resolution_verdict TEXT,
        pkg_id TEXT
    )
    """,
    # Planning: Human Overrides
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
    Now supports both Postgres (Partitioned) and SQLite (Simple).
    """
    conn = get_db_connection(db_path)
    
    try:
        if DATABASE_URL and POSTGRES_AVAILABLE:
            # --- POSTGRES LOGIC ---
            with conn.cursor() as cur:
                # 1. Execute Core Partitioned Schema
                for stmt in POSTGRES_INIT:
                    # Postgres doesn't strictly need JSON type mapping for table creation
                    cur.execute(stmt)
                # 2. Execute Common Tables
                for stmt in COMMON_INIT:
                    cur.execute(stmt)
            conn.commit()
            logger.info(f"✅ [STORAGE] Postgres Enterprise Schema (Partitioned) Initialized via DATABASE_URL.")
        else:
            # --- SQLITE LOGIC ---
            for stmt in SQLITE_INIT + COMMON_INIT:
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
