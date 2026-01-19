from typing import Dict, List

class ConstitutionalFamily:
    """
    Article II: The 4 Families of Perception.
    Every piece of data must belong to one of these families.
    """
    INTRINSIC = "INTRINSIC"       # What it IS (Brand, Category)
    STATE = "STATE"               # What it HAS (Price, Inventory)
    PERFORMANCE = "PERFORMANCE"   # What it DID (Sales, Margin)
    ENVIRONMENTAL = "ENVIRONMENTAL" # What happened TO it (Weather, Comp Price)

class Anchors:
    """
    Physics Anchors required for the Sovereign Logic to function.
    """
    # PRODUCT (Noun)
    PRODUCT_ID = "ANCHOR_PRODUCT_ID"
    PRODUCT_NAME = "ANCHOR_PRODUCT_NAME"
    CATEGORY = "ANCHOR_CATEGORY"
    
    # STATE (Snapshot)
    RETAIL_PRICE = "ANCHOR_RETAIL_PRICE"
    STOCK_ON_HAND = "ANCHOR_STOCK_ON_HAND"
    
    # TRANSACTION (Verb)
    SALES_QTY = "ANCHOR_SALES_QTY"
    SALES_VAL = "ANCHOR_SALES_VAL"
    TX_DATE = "ANCHOR_DATE"

# The Constitution
RETAIL_STANDARDS: Dict[str, Dict] = {
    "PRODUCT": {
        "families": [ConstitutionalFamily.INTRINSIC],
        "mandatory_mappings": [
            Anchors.PRODUCT_ID,
            Anchors.PRODUCT_NAME
        ]
    },
    "INVENTORY": {
        "families": [ConstitutionalFamily.STATE],
        "mandatory_mappings": [
            Anchors.PRODUCT_ID,
            Anchors.STOCK_ON_HAND, # Availability Physics
            Anchors.TX_DATE
        ]
    },
    "PRICING": {
        "families": [ConstitutionalFamily.STATE],
        "mandatory_mappings": [
            Anchors.PRODUCT_ID,
            Anchors.RETAIL_PRICE, # Revenue Physics
            Anchors.TX_DATE
        ]
    },
    "TRANSACTION": {
        "families": [ConstitutionalFamily.PERFORMANCE],
        "mandatory_mappings": [
            Anchors.PRODUCT_ID,
            Anchors.SALES_QTY,
            Anchors.TX_DATE
        ]
    },
    "EXTERNAL_SIGNAL": {
        "families": [ConstitutionalFamily.ENVIRONMENTAL],
        "mandatory_mappings": [
            Anchors.TX_DATE,
            "ANCHOR_SIGNAL_TYPE",
            "ANCHOR_VALUE"
        ]
    }
}
