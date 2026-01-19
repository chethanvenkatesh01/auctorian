import os
import logging
from backend.core.domain_model import domain_mgr
from backend.core.dna import RETAIL_STANDARDS, Anchors
from backend.core.sql_schema import init_db

# Setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("VERIFICATION_BOT")

TEST_DB = "verification_test.db"
if os.path.exists(TEST_DB):
    os.remove(TEST_DB)

# Switch Domain Manager to Test DB
domain_mgr.db_path = TEST_DB
domain_mgr._init_db()

def test_foundation():
    logger.info("🧪 STARTING VERIFICATION: Auctorian Foundation Batch 1")

    # 1. Test Constitution Enforcement (Failure Case)
    logger.info("Phase 1: Testing Article IV (Abstention)...")
    try:
        domain_mgr.register_schema("PRODUCT", [
            {"name": "sku", "generic_anchor": Anchors.PRODUCT_ID}
            # MISSING NAME
        ])
        logger.error("❌ FAILED: System accepted schema despite missing anchors!")
    except ValueError as e:
        logger.info(f"✅ SUCCESS: System rejected invalid schema: {e}")

    # 2. Test Success Case
    logger.info("Phase 2: Testing Valid Registration...")
    try:
        domain_mgr.register_schema("PRODUCT", [
            {"name": "sku", "generic_anchor": Anchors.PRODUCT_ID},
            {"name": "display_name", "generic_anchor": Anchors.PRODUCT_NAME},
            {"name": "mrp", "family_type": "STATE"}
        ])
        logger.info("✅ SUCCESS: Valid schema registered.")
    except Exception as e:
        logger.error(f"❌ FAILED: Valid schema rejected: {e}")

    # 3. Test Anchor Mapping
    logger.info("Phase 3: Testing Anchor Mapping...")
    mapping = domain_mgr.get_anchor_map("PRODUCT")
    if mapping.get(Anchors.PRODUCT_ID) == "sku":
        logger.info(f"✅ SUCCESS: Mapping Verified: {mapping}")
    else:
        logger.error(f"❌ FAILED: Incorrect Mapping: {mapping}")

    # 4. Test Sovereign Lock
    logger.info("Phase 4: Testing System Lock...")
    domain_mgr.lock_system()
    
    if domain_mgr.is_system_locked():
        logger.info("✅ SUCCESS: System is Locked.")
    else:
        logger.error("❌ FAILED: System is NOT locked.")

    # 5. Test Lock Enforcement
    logger.info("Phase 5: Testing Immutable Schema...")
    try:
        domain_mgr.register_schema("PRODUCT", [])
        logger.error("❌ FAILED: System allowed schema change after lock!")
    except PermissionError as e:
        logger.info(f"✅ SUCCESS: System enforced lock: {e}")

if __name__ == "__main__":
    test_foundation()
