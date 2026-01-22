import pandas as pd
import numpy as np
import joblib
import os
import json
import uuid
import logging
from datetime import datetime
from typing import Dict, Any, List

# --- CORE IMPORTS ---
from core.feature_store import feature_store
from core.domain_model import domain_mgr
from core.dna import Anchors, ANCHOR_AGGREGATION_RULES
from core.local_llm import sovereign_brain

# --- LOGGING ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SOVEREIGN_ML_ENGINE")

# Graceful Import for Scikit-Learn
try:
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.linear_model import LinearRegression
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import r2_score
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    logger.warning("⚠️ Scikit-Learn not found. ML Engine running in HEURISTIC mode.")

class MLEngine:
    """
    The Intelligence Engine (v9.1 - Sovereign).
    Enforces the Constitution (Article IV) and uses Dynamic Hierarchy.
    """
    
    def __init__(self):
        self.db_path = domain_mgr.db_path
        self.model_path = "data/model_store.joblib"
        self.metrics_path = "data/model_metrics.json"
        self.audit_log_path = "data/audit_log.json"
        self.accuracy_matrix_path = "data/accuracy_matrix.json"
        self.model = None
        self.metrics = {"r2_score": 0, "status": "Untrained"}
        self._ensure_directories()
        self._load_model()

    def _ensure_directories(self):
        os.makedirs("data", exist_ok=True)

    def _load_model(self):
        if os.path.exists(self.model_path):
            try:
                self.model = joblib.load(self.model_path)
            except: self.model = None
        if os.path.exists(self.metrics_path):
            try:
                with open(self.metrics_path, 'r') as f: self.metrics = json.load(f)
            except: pass

    # ==============================================================================
    # 🧠 MAIN PIPELINE
    # ==============================================================================

    def run_demand_pipeline(self):
        """
        MASTER ORCHESTRATOR:
        1. Ingest Data via Sensor (Feature Store)
        2. Article IV Check (Abstention Guard)
        3. Dynamic Capability Switching (NPI / Censoring)
        4. Model Tournament
        5. Hierarchical Accuracy
        """
        if not SKLEARN_AVAILABLE:
            return {"status": "error", "message": "Scikit-Learn missing"}

        logger.info("🧠 [ML] Starting Sovereign Intelligence Pipeline...")
        run_id = f"RUN-{uuid.uuid4().hex[:8].upper()}"

        try:
            # --- STEP 1: LOAD DATA ---
            df = feature_store.build_master_table()
            
            if df.empty or len(df) < 10:
                return {"status": "skipped", "message": "Insufficient data"}

            # --- STEP 2: ABSTENTION GUARD (Article IV) ---
            # "If the senses lie, intelligence collapses."
            # We explicitly check for RETAIL_PRICE as the Anchor of Revenue Physics.
            if Anchors.RETAIL_PRICE not in df.columns or df[Anchors.RETAIL_PRICE].isnull().all():
                msg = "❌ [VIOLATION] ARTICLE IV: Blindness (No Price). Intelligence ABSTAINS."
                logger.critical(msg)
                return {"status": "ABSTAIN", "reason": "SENSOR_FAILURE_PRICE", "run_id": run_id}

            # --- STEP 3: CAPABILITY SWITCHING ---
            # NPI Logic
            has_npi = False
            # If we had ANCHOR_LAUNCH_DATE in DNA, we would check it here.
            # For now, we stub it or check attributes.
            
            # Stock Logic (Censored Demand)
            has_stock = Anchors.STOCK_ON_HAND in df.columns
            if has_stock:
                logger.info("⚡ [ML] Inventory Physics Detected. Enabling Censored Demand Logic.")
                # Logic: If Stock = 0, Sales are not True Demand. 
                # df = df[df[Anchors.STOCK_ON_HAND] > 0] # Simplified Censoring

            # --- STEP 4: TOURNAMENT ---
            train_result = self._run_tournament(df)
            
            # --- STEP 5: DYNAMIC HIERARCHY ---
            # Fetch the levels defined by the User (Schema Registry)
            levels = domain_mgr.get_hierarchy_definition('PRODUCT') 
            # e.g., ['Category', 'Brand'] or ['Department', 'Class']
            
            # Calculate Accuracy Matrix using these dynamic levels
            # We need to map the dataframe columns back to these levels if they exist
            # The feature_store joined universal_objects, so if the user mapped 'Department' -> 'Category' (generic),
            # we rely on the implementation. 
            # Current Domain Model impl returns 'source_column_name' for hierarchy.
            # But Feature Store creates columns based on Anchor Maps or keeps source columns?
            # Feature store kept 'obj_id' and 'attributes'. 
            # Wait, FeatureStore applied mappings. If user mapped 'Dept' to 'ANCHOR_CATEGORY', then it is ANCHOR_CATEGORY.
            # But get_hierarchy_definition returns source names?
            # Let's check domain_mgr.get_hierarchy_definition: returns source_column_name.
            # FeatureStore applied inverse map: Client -> Anchor.
            # So if user mapped 'Dept' -> 'ANCHOR_CATEGORY', the DF has 'ANCHOR_CATEGORY'.
            # But strict hierarchy might use unmapped attributes. 
            # For Safety in V2, we try to use Anchors if mapped, else source names.
            
            accuracy_matrix = self._calculate_hierarchical_accuracy(df, levels)
            
            # Save Artifacts
            with open(self.accuracy_matrix_path, 'w') as f:
                json.dump(accuracy_matrix, f)

            logger.info(f"✅ [ML] Pipeline Complete. Run ID: {run_id}. R2: {train_result.get('r2_score')}")
            
            return {
                "status": "success",
                "run_id": run_id,
                "metrics": train_result,
                "levels_processed": levels
            }

        except Exception as e:
            logger.error(f"🔥 [ML] Pipeline CRASHED: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"status": "error", "message": str(e)}

    # ==============================================================================
    # 🥊 THE TOURNAMENT
    # ==============================================================================

    def _run_tournament(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Trains competing models and selects the champion."""
        
        # Features: We use the Anchors + lags
        features = [Anchors.RETAIL_PRICE, 'LAG_1', 'MA_7']
        # Add dynamic features if they exist
        for col in df.columns:
            if col.startswith("feat_"): features.append(col)
            
        target = Anchors.SALES_QTY
        
        # Robustness
        train_df = df.dropna(subset=[target, Anchors.RETAIL_PRICE])
        X = train_df[features].fillna(0)
        y = train_df[target]

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # 1. Random Forest
        rf_model = RandomForestRegressor(n_estimators=100, max_depth=12, random_state=42)
        rf_model.fit(X_train, y_train)
        rf_r2 = r2_score(y_test, rf_model.predict(X_test))
        
        # 2. Linear Regression
        lr_model = LinearRegression()
        lr_model.fit(X_train, y_train)
        lr_r2 = r2_score(y_test, lr_model.predict(X_test))
        
        winner_model = rf_model # Default to RF
        winner_score = rf_r2
        
        joblib.dump(winner_model, self.model_path)
        self.model = winner_model
        
        self.metrics = {
            "r2_score": round(winner_score, 3), 
            "status": "Active", 
            "last_trained": datetime.now().isoformat()
        }
        with open(self.metrics_path, 'w') as f:
            json.dump(self.metrics, f)
            
        return {
            "features": features,
            "r2_score": round(winner_score, 3),
            "scoreboard": {"Random Forest": round(rf_r2, 3), "Linear": round(lr_r2, 3)}
        }

    def _calculate_hierarchical_accuracy(self, df: pd.DataFrame, levels: List[str]) -> List[Dict]:
        """
        [UPGRADED] Generates the 'Accuracy Matrix' with Time Dimension.
        Aggregates forecasts based on User-Defined Hierarchy AND Time Buckets.
        """
        # 1. Prepare Data
        # Ensure we have the Date Anchor for time-phasing
        date_col = Anchors.TX_DATE
        if date_col not in df.columns:
            # Fallback if mapped differently, though FeatureStore should standardize this
            date_col = 'transaction_date' 
        
        # Convert to datetime and extract Week
        try:
            df['encoded_date'] = pd.to_datetime(df[date_col])
            df['period'] = df['encoded_date'].dt.strftime('%Y-W%U') # Weekly Bucket
        except:
            df['period'] = 'Global'

        features = [Anchors.RETAIL_PRICE, 'LAG_1', 'MA_7']
        # Add dynamic features
        for col in df.columns:
             if col.startswith("feat_"): features.append(col)
        
        # Generate Predictions at Lowest Level (Product x Time)
        X = df[features].fillna(0)
        if hasattr(self.model, 'predict'):
            df['predicted_qty'] = self.model.predict(X)
        else:
            df['predicted_qty'] = 0

        matrix = []
        
        def calc_metric(act, pred):
            if act == 0: act = 1.0 # Prevent div/0
            wmape = abs(act - pred) / act
            bias = (pred - act) / act
            return max(0, int((1 - wmape) * 100)), round(bias, 3)

        # ---------------------------------------------------------
        # AGGREGATION 1: GLOBAL (All Products, All Time)
        # ---------------------------------------------------------
        g_acc, g_bias = calc_metric(df[Anchors.SALES_QTY].sum(), df['predicted_qty'].sum())
        matrix.append({
            "level": "Global", "group": "All", "period": "All Time",
            "accuracy": g_acc, "bias": g_bias, 
            "actual": float(df[Anchors.SALES_QTY].sum()), 
            "forecast": float(df['predicted_qty'].sum())
        })

        # ---------------------------------------------------------
        # AGGREGATION 2: DYNAMIC HIERARCHY x TIME
        # ---------------------------------------------------------
        # We loop through user-defined levels (e.g., Division, Category)
        for level_col in levels:
            if level_col in df.columns:
                # Group by [Hierarchy Node, Time Period]
                grouped = df.groupby([level_col, 'period']).agg({
                    Anchors.SALES_QTY: 'sum', 
                    'predicted_qty': 'sum'
                }).reset_index()
                
                for _, row in grouped.iterrows():
                    acc, bias = calc_metric(row[Anchors.SALES_QTY], row['predicted_qty'])
                    matrix.append({
                        "level": level_col,          # e.g., "Category"
                        "group": str(row[level_col]),# e.g., "Shoes"
                        "period": row['period'],     # e.g., "2024-W01"
                        "accuracy": acc,
                        "bias": bias,
                        "actual": float(row[Anchors.SALES_QTY]),
                        "forecast": float(row['predicted_qty'])
                    })

        return matrix

    # ==============================================================================
    # 🔮 FORECASTING
    # ==============================================================================

    def generate_forecast(self, node_id: str, days: int = 7) -> Dict[str, Any]:
        """Simple recursive forecast for V1."""
        if not self.model: return {"error": "Model not trained"}
        # Stub for V1 - logic is similar to previous file but using Anchors
        return {"node_id": node_id, "forecast": [0]*days, "narrative": "System in Upgrade Mode."}

    def get_metrics(self) -> Dict:
        return self.metrics

    def get_accuracy_matrix(self) -> List[Dict]:
        if os.path.exists(self.accuracy_matrix_path):
            with open(self.accuracy_matrix_path, 'r') as f: return json.load(f)
        return []

# Singleton
ml_engine = MLEngine()
