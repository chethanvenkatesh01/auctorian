import pandas as pd
import logging
from typing import Dict, Any, List
from .domain_model import domain_mgr
from .dna import Anchors

logger = logging.getLogger("FEATURE_STORE")

class FeatureStore:
    """
    The Sensor: Metadata-Driven Data Preparation.
    Enforces Article III: The Wall of Now.
    """
    
    def build_master_table(self) -> pd.DataFrame:
        """
        Assembles the training dataset by joining Objects + Events
        using the Constitutional Anchors.
        """
        logger.info("🏗️ [SENSOR] Building Master Table from Metadata...")
        
        # 1. Fetch Schema Maps (The Rosetta Stone)
        # Maps Client Column -> System Anchor
        product_map = domain_mgr.get_anchor_map("PRODUCT")
        trx_map = domain_mgr.get_anchor_map("TRANSACTION")
        pricing_map = domain_mgr.get_anchor_map("PRICING")
        
        # 2. Fetch Raw Data
        products = domain_mgr.get_objects("PRODUCT")
        sales_events = domain_mgr.get_events("SALES_QTY", limit=10000)
        
        if not products or not sales_events:
            logger.warning("⚠️ [SENSOR] Empty data universe.")
            return pd.DataFrame()
            
        # 3. Convert to DataFrames
        df_prod = pd.DataFrame(products)
        df_sales = pd.DataFrame(sales_events)
        
        # 4. Standardize Logic (Rename Client Cols -> Anchors)
        # In this implementation, we assume the inputs from domain_mgr are already normalized 
        # or we map them here. Since domain_mgr returns raw objects, we map keys.
        
        # Invert the map: Client Column -> Anchor (for renaming)
        # Note: domain_mgr.get_anchor_map returns {ANCHOR: CLIENT_COL}
        # We need to rename dataframe columns matching CLIENT_COL to ANCHOR
        
        def apply_mapping(df, mapping):
            inv_map = {v: k for k, v in mapping.items()}
            # Also handle the case where data sits in 'attributes' JSON
            # But domain_mgr.get_objects already flattens attributes.
            return df.rename(columns=inv_map)

        df_prod = apply_mapping(df_prod, product_map)
        # Manually ensure ID is mapped if not in map (System field)
        if 'obj_id' in df_prod.columns:
            df_prod[Anchors.PRODUCT_ID] = df_prod['obj_id']

        # For Events, the value is standard 'value', target is 'primary_target_id'
        # We synthesize the Anchor view provided by the Constitution
        df_sales[Anchors.PRODUCT_ID] = df_sales['primary_target_id']
        df_sales[Anchors.SALES_QTY] = df_sales['value']
        df_sales[Anchors.TX_DATE] = pd.to_datetime(df_sales['timestamp'])
        
        # 5. The Join (Noun + Verb)
        # We operate on the Anchor Names, not client names
        full_df = pd.merge(
            df_sales,
            df_prod,
            on=Anchors.PRODUCT_ID,
            how='left'
        )
        
        # 6. Enforce Article III (The Wall of Now)
        # "Performance features must be Lagged."
        full_df.sort_values(by=[Anchors.PRODUCT_ID, Anchors.TX_DATE], inplace=True)
        
        # Lag 1: Last Week's Sales (PERFORMANCE family)
        full_df['LAG_1'] = full_df.groupby(Anchors.PRODUCT_ID)[Anchors.SALES_QTY].shift(1)
        
        # MA 7: Moving Average (if daily data)
        full_df['MA_7'] = full_df.groupby(Anchors.PRODUCT_ID)[Anchors.SALES_QTY].transform(lambda x: x.shift(1).rolling(window=7).mean())
        
        # 7. Handle STATE Variables (Price, Stock)
        # CRITICAL: Stock on Hand is "Opening Stock" (Current State) - DO NOT SHIFT
        # Only shift if we detect it's "Closing Stock" via metadata (future enhancement)
        if Anchors.STOCK_ON_HAND in full_df.columns:
            # Opening Stock = Current State, no lag needed
            full_df[Anchors.STOCK_ON_HAND] = full_df[Anchors.STOCK_ON_HAND].fillna(0)
        
        # Price: Also Current State, no lag
        if Anchors.RETAIL_PRICE in full_df.columns:
            full_df[Anchors.RETAIL_PRICE] = full_df[Anchors.RETAIL_PRICE].fillna(0)
        else:
             logger.warning("⚠️ [SENSOR] Price Anchor missing in Product Master.")
        
        # 8. Execute Derived Field Formulas
        # Query schema_registry for fields with formulas
        try:
            derived_fields = domain_mgr.get_derived_fields()
            if derived_fields:
                logger.info(f"🧮 [FORMULA] Executing {len(derived_fields)} derived field formulas...")
                for field in derived_fields:
                    formula = field.get('formula')
                    anchor_name = field.get('generic_anchor')
                    
                    if formula and anchor_name:
                        # Translate UI formula to Pandas syntax
                        # Replace [ANCHOR_NAME] with df['ANCHOR_NAME']
                        pandas_formula = formula
                        import re
                        # Find all [ANCHOR_*] patterns
                        anchor_refs = re.findall(r'\[([^\]]+)\]', formula)
                        for ref in anchor_refs:
                            if ref in full_df.columns:
                                pandas_formula = pandas_formula.replace(f'[{ref}]', f'`{ref}`')
                            else:
                                logger.warning(f"⚠️ [FORMULA] Referenced anchor '{ref}' not found in data")
                        
                        try:
                            # Execute formula with division by zero protection
                            full_df[anchor_name] = full_df.eval(pandas_formula, engine='python')
                            # Handle division by zero and inf
                            full_df[anchor_name] = full_df[anchor_name].replace([float('inf'), float('-inf')], 0)
                            full_df[anchor_name] = full_df[anchor_name].fillna(0)
                            logger.info(f"  ✓ Calculated: {anchor_name} = {formula}")
                        except Exception as e:
                            logger.error(f"  ✗ Formula execution failed for {anchor_name}: {e}")
                            # Create column with zeros if formula fails
                            full_df[anchor_name] = 0
        except Exception as e:
            logger.warning(f"⚠️ [FORMULA] Could not fetch derived fields: {e}")
             
        logger.info(f"✅ [SENSOR] Master Table Ready: {len(full_df)} rows. Anchors Aligned.")
        return full_df

    def get_latest_features(self, node_id: str) -> pd.DataFrame:
        """Hydrates a single vector for inference."""
        # Simple implementation for V1
        return pd.DataFrame()

feature_store = FeatureStore()
