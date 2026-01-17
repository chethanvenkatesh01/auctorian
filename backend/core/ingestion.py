import pandas as pd
import json
import logging
import hashlib
import re
import uuid
import io
import csv
from datetime import datetime
from typing import Dict, Any, List, Optional
# [FIX] Import shared DB factory
from .sql_schema import get_db_connection, get_placeholder, POSTGRES_AVAILABLE

logger = logging.getLogger("INGESTION_ENGINE")

class IngestionEngine:
    """
    The Data Port (v3.1 - Polyglot & Unified).
    Handles arbitrary CSVs/Excel by mapping them to Objects (Nouns) or Events (Verbs).
    Supports both legacy stream processing and new dashboard mapping.
    """
    
    def __init__(self):
        self.BATCH_SIZE = 2000

    # --- HELPERS (Preserved from v3.0) ---

    def _generate_dedup_key(self, ev_type, target, loc, time_str):
        """Creates a unique hash to enforce Idempotency."""
        raw = f"{ev_type}|{target}|{loc}|{time_str}"
        return hashlib.md5(raw.encode()).hexdigest()

    def _clean_number(self, val: str) -> float:
        if not val: return 0.0
        # Robust cleaner: removes currency symbols, handles negative signs
        clean_val = re.sub(r'[^\d.-]', '', str(val))
        try:
            return float(clean_val)
        except ValueError:
            return 0.0

    def _standardize_date(self, val: str) -> str:
        """Parses MM/DD/YYYY, YYYY-MM-DD, etc. to ISO format."""
        if not val: return None
        # Simplified parser - can be expanded
        try:
            return pd.to_datetime(val).strftime("%Y-%m-%d")
        except:
            return str(val)

    # --- DASHBOARD METHODS (New Requirements for Main.py) ---

    def preview_file(self, file_path: str) -> Dict[str, Any]:
        """Reads the first few rows to help user map columns in the UI."""
        try:
            if file_path.endswith('.csv'):
                df = pd.read_csv(file_path, nrows=5)
            else:
                df = pd.read_excel(file_path, nrows=5)
            
            # Replace NaNs with None for JSON serialization
            df = df.where(pd.notnull(df), None)
            
            return {
                "columns": list(df.columns),
                "sample": df.to_dict(orient='records'),
                "row_count_estimate": "Unknown (Streamed)"
            }
        except Exception as e:
            logger.error(f"Preview failed: {e}")
            return {"error": str(e)}

    def apply_mapping(self, file_path: str, mapping: Dict[str, str]) -> Dict[str, Any]:
        """
        Transforms and Loads data based on user mapping from UI.
        Wrapper around process_generic_stream logic but adapted for file paths.
        """
        try:
            # 1. Load Data
            if file_path.endswith('.csv'):
                df = pd.read_csv(file_path)
            else:
                df = pd.read_excel(file_path)
            
            # 2. Convert to list of dicts to reuse generic processor
            records = df.to_dict(orient='records')
            
            # 3. Construct Config
            # Invert mapping: {UserCol: SystemCol} -> {SystemCol: UserCol}
            # Actually, process_generic_stream expects {SystemKey: UserKey} in mapping
            # The UI usually sends {UserCol: SystemCol}. Let's assume UI sends {SystemCol: UserCol} 
            # or we adapt. Let's adapt based on standard assumption:
            # If mapping is {'Date': 'timestamp'}, we need to pass that to processor.
            
            config = {
                'type': 'EVENT', # Defaulting to Event import
                'mapping': mapping, # Expected format: {'primary_target_id': 'SKU', 'timestamp': 'Date', ...}
                'entity_name': 'IMPORTED_EVENT' 
            }
            
            return self.process_generic_stream(records, config)
            
        except Exception as e:
            logger.error(f"Mapping application failed: {e}")
            return {"status": "error", "message": str(e)}

    # --- CORE PROCESSING (Preserved & Postgres-Enabled) ---

    def process_generic_stream(self, data: List[Dict], config: Dict[str, Any]):
        """
        Core ETL Logic. 
        config: {
            'type': 'OBJECT' | 'EVENT',
            'entity_name': 'PRODUCT',
            'mapping': {'target_field': 'source_column'}
        }
        """
        conn = get_db_connection()
        ph = get_placeholder() # ? or %s
        
        mapping = config.get('mapping', {})
        import_type = config.get('type', 'EVENT')
        entity_name = config.get('entity_name', 'UNKNOWN')

        objects_batch = []
        events_batch = []
        
        try:
            for row in data:
                # 1. Map Fields
                mapped_row = {}
                for target_field, source_col in mapping.items():
                    if source_col in row:
                        mapped_row[target_field] = row[source_col]
                
                # 2. Handle Objects
                if import_type == 'OBJECT':
                    obj_id = mapped_row.get('obj_id') or str(uuid.uuid4())
                    objects_batch.append((
                        str(obj_id),
                        entity_name,
                        mapped_row.get('name', str(obj_id)),
                        json.dumps(row, default=str) # Store raw data as attributes
                    ))

                # 3. Handle Events
                elif import_type == 'EVENT':
                    target_id = mapped_row.get('primary_target_id')
                    val = self._clean_number(mapped_row.get('value'))
                    ts = self._standardize_date(mapped_row.get('timestamp')) or datetime.now().isoformat()
                    
                    if target_id:
                        # Auto-create implied object if missing? (Optional, skipping for speed)
                        
                        # Dedup Key
                        evt_id = self._generate_dedup_key(entity_name, target_id, 'GLOBAL', ts)
                        
                        events_batch.append((
                            evt_id,
                            str(target_id),
                            entity_name, # Event Type (e.g., SALES_QTY)
                            float(val),
                            ts,
                            json.dumps({"source": "ingestion_engine"})
                        ))

            # 4. Bulk Write
            cursor = conn.cursor()
            
            if objects_batch:
                query = f"INSERT INTO universal_objects (obj_id, obj_type, name, attributes) VALUES ({ph}, {ph}, {ph}, {ph}) ON CONFLICT(obj_id) DO NOTHING"
                if POSTGRES_AVAILABLE and hasattr(cursor, 'execute'): # Postgres
                    # Use a loop or execute_batch if available. 
                    # For safety across drivers, we loop or use standard executemany
                    for obj in objects_batch:
                        cursor.execute(query, obj)
                else: # SQLite
                    conn.executemany(query, objects_batch)

            if events_batch:
                query = f"INSERT INTO universal_events (event_id, primary_target_id, event_type, value, timestamp, meta) VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}) ON CONFLICT(event_id) DO NOTHING"
                if POSTGRES_AVAILABLE:
                    from psycopg2.extras import execute_batch
                    execute_batch(cursor, query, events_batch)
                else:
                    conn.executemany(query, events_batch)

            conn.commit()
            return {"status": "success", "processed": len(data)}

        except Exception as e:
            logger.error(f"Stream processing failed: {e}")
            conn.rollback()
            return {"status": "error", "message": str(e)}
        finally:
            conn.close()

    def process_metric_stream(self, file_content: str, mapping: Dict[str, str], metric_prefix: str = 'SALES'):
        """Legacy wrapper for raw file content ingestion."""
        try:
            # Parse CSV string to list of dicts
            f = io.StringIO(file_content)
            reader = csv.DictReader(f)
            data = list(reader)
            
            # Map legacy mapping keys to new Universal Event keys
            new_mapping = {
                'primary_target_id': mapping.get('SKU', 'SKU'),
                'timestamp': mapping.get('Date', 'Date'),
                'value': mapping.get('Qty', 'Qty')
                # Location handling omitted for brevity/compatibility
            }
            config = {
                'type': 'EVENT',
                'entity_name': f"{metric_prefix}_QTY", 
                'mapping': new_mapping
            }
            return self.process_generic_stream(data, config)
        except Exception as e:
             return {"error": str(e)}

# Singleton Instance
ingestion_engine = IngestionEngine()

# --- HELPER FOR MAIN.PY IMPORT ---
def ingest_file(file_obj, config, filename):
    """Wrapper to handle file reading and call the engine."""
    try:
        content = file_obj.read()
        if isinstance(content, bytes):
            content = content.decode('utf-8')
        
        # Determine mapping type from config or filename
        # This is a stub to maintain backward compatibility with old calls
        return ingestion_engine.process_metric_stream(content, config.get('mapping', {}))
    except Exception as e:
        return {"error": str(e)}
