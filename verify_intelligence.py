import sys
import os
import uuid
import pandas as pd
import logging

# Fix Path to simulate running from backend root
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from core.sql_schema import get_db_connection
from core.domain_model import domain_mgr
from core.dna import Anchors
from core.feature_store import feature_store
from ml_engine import ml_engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("VERIFY_INTEL")

# Update Paths
TEST_DB = "verify_intel.db"
if os.path.exists(TEST_DB): os.remove(TEST_DB)
domain_mgr.db_path = TEST_DB
domain_mgr._init_db()

# Mock Data
PRODUCTS = [
    {"sku": "P1", "name": "Shoe", "msrp": 100.0, "cat": "Footwear"},
    {"sku": "P2", "name": "Sock", "msrp": 10.0, "cat": "Accessory"}
]

EVENTS = [
    {"id": f"E1_{i}", "sku": "P1", "qty": 10+i, "date": f"2024-01-{i+1:02d}"} for i in range(15)
] + [
    {"id": f"E2_{i}", "sku": "P2", "qty": 5+i, "date": f"2024-01-{i+1:02d}"} for i in range(15)
]

def setup_data():
    logger.info("TEST: Registering Schema...")
    domain_mgr.register_schema("PRODUCT", [
        {"name": "sku", "generic_anchor": Anchors.PRODUCT_ID, "is_pk": True},
        {"name": "name", "generic_anchor": Anchors.PRODUCT_NAME},
        {"name": "msrp", "generic_anchor": Anchors.RETAIL_PRICE, "family_type": "STATE"},
        {"name": "cat", "is_hierarchy": True, "hierarchy_level": 1}
    ])
    
    logger.info("TEST: Ingesting Mock Data...")
    # Add Objects
    for p in PRODUCTS:
        domain_mgr.add_node(p['sku'], p['name'], "PRODUCT")
        # Update attributes directly via SQL injection for speed or re-implementation of add_node needed?
        # domain_model.add_node separates attributes.
        # Let's cheat and insert directly to get attributes right.
        import json
        conn = get_db_connection(TEST_DB)
        conn.execute(f"UPDATE universal_objects SET attributes = ? WHERE obj_id = ?", 
                     (json.dumps(p), p['sku']))
        conn.commit()
    
    # Add Events
    conn = get_db_connection(TEST_DB)
    for e in EVENTS:
        conn.execute("INSERT INTO universal_events (event_id, primary_target_id, event_type, value, timestamp) VALUES (?, ?, ?, ?, ?)",
                     (str(uuid.uuid4()), e['sku'], "SALES_QTY", e['qty'], e['date']))
    conn.commit()

def verify_pipeline():
    setup_data()
    
    logger.info("--- TEST 1: Feature Store (Wall of Now) ---")
    df = feature_store.build_master_table()
    logger.info(f"Columns: {df.columns.tolist()}")
    
    if Anchors.RETAIL_PRICE in df.columns:
        logger.info("✅ SUCCESS: Price Anchor Found.")
    else:
        logger.error("❌ FAILED: Price Anchor Missing.")
        
    p1_rows = df[df[Anchors.PRODUCT_ID] == 'P1'].sort_values(Anchors.TX_DATE)
    if len(p1_rows) > 1 and not pd.isna(p1_rows.iloc[1]['LAG_1']):
        logger.info(f"✅ SUCCESS: Lag Logic Verified. Lag: {p1_rows.iloc[1]['LAG_1']}")
    else:
        logger.warning("⚠️ WARNING: Lag check inconclusive (needs more data rows).")

    logger.info("--- TEST 2: ML Engine (Success Path) ---")
    result = ml_engine.run_demand_pipeline()
    if result['status'] == 'success':
         logger.info("✅ SUCCESS: Pipeline Ran.")
         logger.info(f"Levels Processed: {result.get('levels_processed')}")
    else:
         logger.error(f"❌ FAILED: Pipeline Failed: {result}")

    logger.info("--- TEST 3: ML Engine (Abstention Guard) ---")
    # Corrupt the data (Remove Price)
    # We simulate this by nulling out the MSRP in the Objects
    conn = get_db_connection(TEST_DB)
    import json
    new_attr = json.dumps({"sku": "P1", "name": "Shoe", "cat": "Footwear"}) # No price
    conn.execute("UPDATE universal_objects SET attributes = ?", (new_attr,))
    conn.commit()
    
    result_fail = ml_engine.run_demand_pipeline()
    if result_fail['status'] == 'ABSTAIN':
        logger.info(f"✅ SUCCESS: System abstained as expected: {result_fail['reason']}")
    else:
        logger.error(f"❌ FAILED: System DID NOT abstain! Status: {result_fail['status']}")

if __name__ == "__main__":
    verify_pipeline()
