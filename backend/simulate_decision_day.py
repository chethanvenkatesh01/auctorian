import os
import json
import random
import uuid
import logging
from datetime import datetime, timedelta
import numpy as np

# --- DATABASE ADAPTER ---
try:
    import psycopg2
    from psycopg2.extras import execute_batch
    POSTGRES_AVAILABLE = True
except ImportError:
    POSTGRES_AVAILABLE = False
    import sqlite3

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SIMULATION_ENGINE")

# --- CONFIGURATION ---
DAYS_HISTORY = 400
START_DATE = datetime.now() - timedelta(days=DAYS_HISTORY)
DATABASE_URL = os.environ.get("DATABASE_URL")

def get_db_connection():
    """Factory to get the correct DB connection."""
    if DATABASE_URL and POSTGRES_AVAILABLE:
        return psycopg2.connect(DATABASE_URL)
    else:
        import sqlite3
        return sqlite3.connect("ados_ledger.db")

def get_placeholder():
    """Returns '%s' for Postgres or '?' for SQLite"""
    return "%s" if (DATABASE_URL and POSTGRES_AVAILABLE) else "?"

# --- 1. THE CAST OF CHARACTERS (CATALOG) ---
CATALOG = [
    # --- DOMAIN 1: REPLENISHMENT ---
    {
        "id": "PUMA-PALERMO-GRN",
        "name": "Puma Palermo (Viral Green)",
        "attributes": {
            "category": "Footwear", "brand": "Puma", "cost": 45.0, "lead_time_days": 14, "moq": 50,
            "dna": "VIRAL_SPIKE" 
        },
        "base_price": 90.0
    },
    {
        "id": "PUMA-VELOCITY-3",
        "name": "Velocity Nitro 3",
        "attributes": {
            "category": "Running", "brand": "Puma", "cost": 60.0, "lead_time_days": 60, "moq": 100,
            "dna": "SUPPLY_SHOCK" 
        },
        "base_price": 130.0
    },
    {
        "id": "PUMA-ESS-TEE-BLK",
        "name": "Essentials Logo Tee",
        "attributes": {
            "category": "Apparel", "brand": "Puma", "cost": 8.0, "lead_time_days": 7, "moq": 500,
            "dna": "PHANTOM" 
        },
        "base_price": 25.0
    },
    # --- DOMAIN 2: PRICING ---
    {
        "id": "PUMA-SUEDE-CL",
        "name": "Suede Classic XXI",
        "attributes": {
            "category": "Classics", "brand": "Puma", "cost": 35.0, "lead_time_days": 14, "moq": 50,
            "dna": "LOSS_LEADER" 
        },
        "base_price": 75.0
    },
    {
        "id": "PUMA-NO1-LOGO",
        "name": "No.1 Logo Tee",
        "attributes": {
            "category": "Apparel", "brand": "Puma", "cost": 10.0, "lead_time_days": 10, "moq": 200,
            "dna": "INELASTIC" 
        },
        "base_price": 30.0
    },
    # --- DOMAIN 3: MARKDOWN ---
    {
        "id": "PUMA-RSX-PREPPY",
        "name": "RS-X Preppy",
        "attributes": {
            "category": "Footwear", "brand": "Puma", "cost": 55.0, "lead_time_days": 21, "moq": 20,
            "dna": "BROKEN_SIZE" 
        },
        "base_price": 110.0
    },
    {
        "id": "FERRARI-RACE-JKT",
        "name": "Scuderia Ferrari Race Jacket",
        "attributes": {
            "category": "Motorsport", "brand": "Ferrari", "cost": 80.0, "lead_time_days": 45, "moq": 10,
            "dna": "BRAND_EQUITY" 
        },
        "base_price": 180.0
    },
    # --- DOMAIN 4: ALLOCATION ---
    {
        "id": "MB-03-TOXIC",
        "name": "MB.03 Toxic (LaMelo)",
        "attributes": {
            "category": "Basketball", "brand": "Puma", "cost": 65.0, "lead_time_days": 30, "moq": 50,
            "dna": "OMNI_RESCUE" 
        },
        "base_price": 125.0
    }
]

def clean_slate(conn):
    """
    CRITICAL FIX: Deletes data in the correct order to respect Foreign Keys.
    1. Events (Children)
    2. Objects (Parents)
    """
    logger.info("🧹 Cleaning up old simulation data...")
    cursor = conn.cursor()
    # DELETE CHILDREN FIRST
    cursor.execute("DELETE FROM universal_events")
    # DELETE PARENTS SECOND
    cursor.execute("DELETE FROM universal_objects WHERE obj_type='PRODUCT'")
    conn.commit()
    logger.info("✨ Clean slate achieved.")

def setup_catalog(conn):
    logger.info("📦 Seeding Catalog...")
    cursor = conn.cursor()
    
    # Insert new products
    ph = get_placeholder() # ? or %s
    query = f"INSERT INTO universal_objects (obj_id, obj_type, name, attributes) VALUES ({ph}, {ph}, {ph}, {ph})"
    
    data = []
    for item in CATALOG:
        data.append((item['id'], 'PRODUCT', item['name'], json.dumps(item['attributes'])))
    
    if DATABASE_URL and POSTGRES_AVAILABLE:
        execute_batch(cursor, query, data)
    else:
        cursor.executemany(query, data)
        
    conn.commit()

# --- 2. THE SIMULATOR ENGINE ---

def generate_events(conn):
    logger.info("📈 Generating Retail Reality...")
    events = []
    
    # Inventory State
    inv = {item['id']: 200 for item in CATALOG}
    inv["PUMA-ESS-TEE-BLK"] = 5 
    inv["PUMA-RSX-PREPPY"] = 150
    inv["FERRARI-RACE-JKT"] = 80
    inv["MB-03-TOXIC"] = 0

    cursor = conn.cursor()

    for day_offset in range(DAYS_HISTORY + 1):
        curr_date = START_DATE + timedelta(days=day_offset)
        date_str = curr_date.strftime("%Y-%m-%d")
        
        is_weekend = curr_date.weekday() >= 5
        days_from_now = (datetime.now() - curr_date).days

        for item in CATALOG:
            sku = item['id']
            dna = item['attributes']['dna']
            price = item['base_price']
            
            # --- SCENARIO LOGIC ---
            if dna == "VIRAL_SPIKE":
                base_demand = np.random.normal(10, 2)
                if days_from_now < 7: base_demand = np.random.normal(150, 20) 
            elif dna == "SUPPLY_SHOCK":
                base_demand = np.random.normal(25, 5) 
            elif dna == "PHANTOM":
                base_demand = 0 
            elif dna == "LOSS_LEADER":
                base_demand = np.random.normal(30, 5)
                if random.random() < 0.15:
                    comp_price = 30.0
                    events.append((str(uuid.uuid4()), sku, "COMP_PRICE", comp_price, date_str, json.dumps({"source":"CRAWLER"})))
            elif dna == "INELASTIC":
                if days_from_now < 30: price += 5.0 
                base_demand = np.random.normal(20, 2)
            elif dna == "BROKEN_SIZE":
                base_demand = 0 
            elif dna == "BRAND_EQUITY":
                base_demand = np.random.poisson(0.5)
            elif dna == "OMNI_RESCUE":
                base_demand = np.random.normal(40, 5)
            else:
                base_demand = 10

            # Physics
            if is_weekend and dna not in ["PHANTOM", "BROKEN_SIZE"]:
                base_demand *= 1.4

            sales = max(0, int(base_demand))
            
            if dna == "PHANTOM":
                sales = 0
            elif inv[sku] < sales:
                sales = inv[sku]
            
            inv[sku] -= sales
            
            # --- LOG EVENTS ---
            events.append((str(uuid.uuid4()), sku, "PRICE", price, date_str, json.dumps({"source":"SYSTEM"})))
            
            if sales > 0:
                events.append((str(uuid.uuid4()), sku, "SALES_QTY", sales, date_str, json.dumps({"source":"POS"})))
            
            snapshot_qty = 5 if dna == "PHANTOM" else inv[sku]
            events.append((str(uuid.uuid4()), sku, "INV_SNAPSHOT", snapshot_qty, date_str, json.dumps({"source":"WMS"})))

            # Replenishment
            if dna not in ["PHANTOM", "BROKEN_SIZE", "BRAND_EQUITY", "OMNI_RESCUE"] and inv[sku] < 50:
                inv[sku] += 200

        if day_offset % 50 == 0:
            logger.info(f"   ... Processed {date_str}")

    logger.info(f"💾 Committing {len(events)} events to database...")
    
    ph = get_placeholder() # ? or %s
    query = f"""
        INSERT INTO universal_events 
        (event_id, primary_target_id, event_type, value, timestamp, meta) 
        VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph})
    """
    
    if DATABASE_URL and POSTGRES_AVAILABLE:
        execute_batch(cursor, query, events, page_size=1000)
    else:
        cursor.executemany(query, events)
    
    conn.commit()

if __name__ == "__main__":
    try:
        logger.info(f"🌍 INITIALIZING PUMA RETAIL UNIVERSE")
        if DATABASE_URL:
            logger.info("🔌 Connecting to POSTGRES...")
        else:
            logger.info("🔌 Connecting to SQLite (Local)...")
            
        with get_db_connection() as conn:
            # [FIX] Added clean_slate to handle FK constraints
            clean_slate(conn)
            setup_catalog(conn)
            generate_events(conn)
        logger.info("\n✅ SIMULATION COMPLETE. The World is Ready.")
    except Exception as e:
        logger.error(f"\n❌ FATAL ERROR: {e}")
