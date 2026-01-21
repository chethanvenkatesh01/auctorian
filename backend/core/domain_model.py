import json
import logging
from typing import List, Dict, Optional, Any
# IMPORTS FROM THE SHARED SCHEMA MODULE
from .sql_schema import init_db, get_db_connection, get_placeholder, POSTGRES_AVAILABLE
from .dna import RETAIL_STANDARDS, ConstitutionalFamily

logger = logging.getLogger("DOMAIN_MANAGER")

class DomainManager:
    """
    Guardian of the Universal Graph (v5.2 - Hierarchy Aware & Partition Ready).
    Manages the flexible Ontology, infers Schema from live data, and provides
    Hierarchy mappings for the Intelligence Layer.
    """
    def __init__(self, db_path="ados_ledger.db"):
        self.db_path = db_path
        self._init_db()        
        self._ensure_indices()

    def _init_db(self):
        """Initializes the Graph Schema via the shared factory."""
        init_db(self.db_path)

    def _ensure_indices(self):
        """Performance optimizations for the Graph."""
        conn = get_db_connection(self.db_path)
        try:
            # Note: With Partitioning, some indices are managed at the partition level
            # in sql_schema.py, but we keep this for SQLite compatibility.
            cmds = [
                "CREATE INDEX IF NOT EXISTS idx_evt_agg ON universal_events(event_type, timestamp)",
                "CREATE INDEX IF NOT EXISTS idx_obj_lookup ON universal_objects(obj_type, obj_id)"
            ]
            
            if POSTGRES_AVAILABLE and hasattr(conn, 'cursor'):
                with conn.cursor() as cur:
                    for cmd in cmds:
                        try: cur.execute(cmd)
                        except: pass
                conn.commit()
            else:
                for cmd in cmds:
                    conn.execute(cmd)
                conn.commit()
        except Exception as e:
            logger.warning(f"Index creation skipped: {e}")
        finally:
            conn.close()

    # =========================================================
    # 0. SOVEREIGN GOVERNANCE (The Laws)
    # =========================================================

    def is_system_locked(self) -> bool:
        """Checks if the system has entered Phase 2 (Operational)."""
        conn = get_db_connection(self.db_path)
        try:
            ph = get_placeholder()
            res = conn.execute(f"SELECT config_value FROM system_config WHERE config_key = 'SYSTEM_LOCKED'").fetchone()
            return res[0] == 'TRUE' if res else False
        except:
            return False
        finally:
            conn.close()

    def lock_system(self):
        """Irreversibly transitions the system to Operational Phase."""
        conn = get_db_connection(self.db_path)
        try:
            ph = get_placeholder()
            query = f"INSERT OR REPLACE INTO system_config (config_key, config_value, description) VALUES ({ph}, {ph}, {ph})"
            if POSTGRES_AVAILABLE and hasattr(conn, 'cursor'):
                with conn.cursor() as cur:
                    cur.execute("INSERT INTO system_config (config_key, config_value, description) VALUES (%s, %s, %s) ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value", 
                                ('SYSTEM_LOCKED', 'TRUE', 'Schema is now immutable.'))
                conn.commit()
            else:
                conn.execute(query, ('SYSTEM_LOCKED', 'TRUE', 'Schema is now immutable.'))
                conn.commit()
            logger.info("🔐 [SOVEREIGN] SYSTEM LOCKED. Schema changes now forbidden.")
        except Exception as e:
            logger.error(f"Failed to lock system: {e}")
        finally:
            conn.close()

    def register_schema(self, entity_type: str, rows: List[Dict]):
        """
        Phase 1 Action: Ingests the Ontology.
        ENFORCES: Article IV (Abstention) - Checks for mandatory Anchors.
        """
        if self.is_system_locked():
            raise PermissionError("❌ SYSTEM LOCKED. Schema changes forbidden in Operational Phase.")

        # 1. Validation (Article IV)
        standards = RETAIL_STANDARDS.get(entity_type)
        if not standards:
            logger.warning(f"⚠️ Registering unknown entity type {entity_type} without Constitutional checks.")
        else:
            required = set(standards['mandatory_mappings'])
            # Extract anchors provided in the rows
            provided_anchors = set()
            for r in rows:
                if r.get('generic_anchor'):
                    provided_anchors.add(r['generic_anchor'])
            
            missing = required - provided_anchors
            if missing:
                error_msg = f"❌ [CONSTITUTIONAL VIOLATION] Missing Anchors for {entity_type}: {missing}. System ABSTAINS."
                logger.critical(error_msg)
                raise ValueError(error_msg)

        # 2. Storage
        conn = get_db_connection(self.db_path)
        try:
            ph = get_placeholder()
            # Clean old definitions for this entity (during Phase 1 only)
            if POSTGRES_AVAILABLE and hasattr(conn, 'cursor'):
                 with conn.cursor() as cur:
                    cur.execute(f"DELETE FROM schema_registry WHERE entity_type = {ph}", (entity_type,))
                    
                    insert_query = f"""
                        INSERT INTO schema_registry 
                        (entity_type, source_column_name, generic_anchor, family_type, is_pk, is_attribute, is_hierarchy, hierarchy_level, formula)
                        VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                    """
                    data = [(
                        entity_type, 
                        r.get('source_column_name') or r.get('name'),  # Support both new and old format
                        r.get('generic_column_name') or r.get('generic_anchor'),  # Support both new and old
                        r.get('family_type', 'INTRINSIC'),
                        r.get('is_pk', False), 
                        r.get('is_attribute', True), 
                        r.get('is_hierarchy', False),
                        r.get('hierarchy_level'), 
                        r.get('formula')
                    ) for r in rows]
                    
                    from psycopg2.extras import execute_batch
                    execute_batch(cur, insert_query, data)
                 conn.commit()
            else:
                 conn.execute(f"DELETE FROM schema_registry WHERE entity_type = {ph}", (entity_type,))
                 insert_query = f"""
                        INSERT INTO schema_registry 
                        (entity_type, source_column_name, generic_anchor, family_type, is_pk, is_attribute, is_hierarchy, hierarchy_level, formula)
                        VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                    """
                 data = [(
                        entity_type, 
                        r.get('source_column_name') or r.get('name'),  # Support both new and old format
                        r.get('generic_column_name') or r.get('generic_anchor'),  # Support both new and old
                        r.get('family_type', 'INTRINSIC'),
                        r.get('is_pk', False), 
                        r.get('is_attribute', True), 
                        r.get('is_hierarchy', False),
                        r.get('hierarchy_level'), 
                        r.get('formula')
                    ) for r in rows]
                 conn.executemany(insert_query, data)
                 conn.commit()

            logger.info(f"📜 [ONTOLOGY] Registered {len(rows)} fields for {entity_type}.")

        except Exception as e:
            logger.error(f"Failed to register schema: {e}")
            raise e
        finally:
            conn.close()

    def get_anchor_map(self, entity_type: str) -> Dict[str, str]:
        """Returns MAPPING: ANCHOR_NAME -> CLIENT_COLUMN_NAME"""
        conn = get_db_connection(self.db_path)
        ph = get_placeholder()
        try:
            query = f"SELECT generic_anchor, source_column_name FROM schema_registry WHERE entity_type={ph} AND generic_anchor IS NOT NULL"
            if POSTGRES_AVAILABLE and hasattr(conn, 'cursor'):
                 with conn.cursor() as cur:
                    cur.execute(query, (entity_type,))
                    return {row[0]: row[1] for row in cur.fetchall()}
            else:
                rows = conn.execute(query, (entity_type,)).fetchall()
                return {row[0]: row[1] for row in rows}
        finally:
            conn.close()

    def get_hierarchy_definition(self, entity_type: str) -> List[str]:
        """Returns the ordered hierarchy levels (Schema Aware)."""
        conn = get_db_connection(self.db_path)
        ph = get_placeholder()
        try:
            query = f"SELECT source_column_name FROM schema_registry WHERE entity_type={ph} AND is_hierarchy=1 ORDER BY hierarchy_level ASC"
            if POSTGRES_AVAILABLE and hasattr(conn, 'cursor'):
                 with conn.cursor() as cur:
                    cur.execute(query, (entity_type,))
                    return [row[0] for row in cur.fetchall()]
            else:
                rows = conn.execute(query, (entity_type,)).fetchall()
                return [row[0] for row in rows]
        finally:
            conn.close()

    # =========================================================
    # 1. CORE GRAPH API (Retrieval)
    # =========================================================

    def get_objects(self, obj_type: str) -> List[Dict]:
        """Fetches Nouns (Products, Locations) from the Universal Store."""
        conn = get_db_connection(self.db_path)
        ph = get_placeholder()
        
        try:
            if POSTGRES_AVAILABLE and hasattr(conn, 'cursor'):
                from psycopg2.extras import RealDictCursor
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(f"SELECT * FROM universal_objects WHERE obj_type = {ph}", (obj_type,))
                    rows = cur.fetchall()
                    results = [dict(r) for r in rows]
            else:
                rows = conn.execute(f"SELECT * FROM universal_objects WHERE obj_type = {ph}", (obj_type,)).fetchall()
                results = [dict(r) for r in rows]

            final_list = []
            for item in results:
                # Merge JSON attributes into the top-level dictionary
                # This flattens the structure for the Frontend and ML Engine
                if item.get('attributes'):
                    try:
                        attrs = item['attributes']
                        if isinstance(attrs, str):
                            attrs = json.loads(attrs)
                        item.update(attrs)
                    except: pass
                final_list.append(item)
            return final_list
        finally:
            conn.close()

    def get_events(self, event_type: str, target_id: str = None, limit: int = 100) -> List[Dict]:
        """Fetches Verbs (Sales, Prices) from the Event Store."""
        conn = get_db_connection(self.db_path)
        ph = get_placeholder()
        
        try:
            query = f"SELECT * FROM universal_events WHERE event_type = {ph}"
            params = [event_type]
            
            if target_id:
                query += f" AND primary_target_id = {ph}"
                params.append(target_id)
            
            query += f" ORDER BY timestamp DESC LIMIT {limit}"
            
            if POSTGRES_AVAILABLE and hasattr(conn, 'cursor'):
                from psycopg2.extras import RealDictCursor
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(query, tuple(params))
                    rows = cur.fetchall()
                    return [dict(r) for r in rows]
            else:
                rows = conn.execute(query, tuple(params)).fetchall()
                return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_derived_fields(self) -> List[Dict]:
        """
        Fetches all fields from schema_registry that have formulas defined.
        Used by feature_store to calculate derived columns.
        """
        conn = get_db_connection(self.db_path)
        try:
            query = "SELECT generic_anchor, formula FROM schema_registry WHERE formula IS NOT NULL"
            
            if POSTGRES_AVAILABLE and hasattr(conn, 'cursor'):
                from psycopg2.extras import RealDictCursor
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(query)
                    rows = cur.fetchall()
                    return [dict(r) for r in rows]
            else:
                rows = conn.execute(query).fetchall()
                return [dict(r) for r in rows]
        except Exception as e:
            logger.error(f"Failed to fetch derived fields: {e}")
            return []
        finally:
            conn.close()

    def get_full_registry(self) -> Dict[str, List[Dict]]:
        """
        Returns all registered schemas grouped by entity type.
        Used for UI state hydration and schema management.
        """
        conn = get_db_connection(self.db_path)
        try:
            query = "SELECT * FROM schema_registry ORDER BY entity_type, hierarchy_level"
            
            if POSTGRES_AVAILABLE and hasattr(conn, 'cursor'):
                from psycopg2.extras import RealDictCursor
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(query)
                    rows = cur.fetchall()
                    all_fields = [dict(r) for r in rows]
            else:
                rows = conn.execute(query).fetchall()
                all_fields = [dict(r) for r in rows]
            
            # Group by entity_type
            registry = {}
            for field in all_fields:
                entity_type = field.get('entity_type')
                if entity_type not in registry:
                    registry[entity_type] = []
                registry[entity_type].append(field)
            
            logger.info(f"📋 [REGISTRY] Loaded {len(registry)} entity schemas")
            return registry
        except Exception as e:
            logger.error(f"Failed to fetch registry: {e}")
            return {}
        finally:
            conn.close()

    def delete_schema(self, entity_type: str):
        """
        Removes a schema from the registry.
        WARNING: This is a destructive operation.
        """
        conn = get_db_connection(self.db_path)
        ph = get_placeholder()
        try:
            if POSTGRES_AVAILABLE and hasattr(conn, 'cursor'):
                with conn.cursor() as cur:
                    cur.execute(f"DELETE FROM schema_registry WHERE entity_type = {ph}", (entity_type,))
                conn.commit()
            else:
                conn.execute(f"DELETE FROM schema_registry WHERE entity_type = {ph}", (entity_type,))
                conn.commit()
            
            logger.info(f"🗑️ [REGISTRY] Deleted schema: {entity_type}")
        except Exception as e:
            logger.error(f"Failed to delete schema {entity_type}: {e}")
            raise
        finally:
            conn.close()

    def get_stats(self):
        """Telemetry for the Command Center."""
        conn = get_db_connection(self.db_path)
        try:
            if POSTGRES_AVAILABLE and hasattr(conn, 'cursor'):
                 with conn.cursor() as cur:
                    cur.execute("SELECT COUNT(*) FROM universal_objects")
                    objs = cur.fetchone()[0]
                    cur.execute("SELECT COUNT(*) FROM universal_events")
                    evts = cur.fetchone()[0]
            else:
                objs = conn.execute("SELECT COUNT(*) FROM universal_objects").fetchone()[0]
                evts = conn.execute("SELECT COUNT(*) FROM universal_events").fetchone()[0]
            
            return {"objects": objs, "events": evts, "status": "Graph Active"}
        except:
            return {"objects": 0, "events": 0, "status": "Graph Empty"}
        finally:
            conn.close()

    # =========================================================
    # 2. HIERARCHY & CONTRACTS (Enterprise Features)
    # =========================================================

    def get_hierarchy_map(self) -> Dict[str, Dict]:
        """
        [NEW] Returns a lookup table to map SKU IDs to their Hierarchies.
        Used by ML Engine to aggregate forecasts from SKU -> Category -> Brand.
        """
        products = self.get_objects('PRODUCT')
        hierarchy = {}
        for p in products:
            # We look for standard retail hierarchy keys in the attributes
            hierarchy[p['obj_id']] = {
                'category': p.get('category', 'Unknown'),
                'brand': p.get('brand', 'Unknown'),
                'region': p.get('region', 'Global'),
                'sub_category': p.get('sub_category', 'General')
            }
        return hierarchy

    def get_structure(self, obj_type: str = None) -> Dict[str, Any]:
        """
        [UPDATED] 🔮 INTROSPECTION ENGINE
        Scans the actual data to auto-discover the Data Contract.
        Now identifies 'Dimensions' (Category, Brand) for the UI.
        """
        target_type = obj_type if obj_type else 'PRODUCT'
        objects = self.get_objects(target_type)
        
        if not objects:
            return {"entity": target_type, "status": "EMPTY", "fields": []}

        # 1. Infer Fields by scanning a sample
        fields_map = {}
        # Scan up to 50 items to get a good representative schema
        for obj in objects[:50]: 
            for k, v in obj.items():
                if k not in ['obj_id', 'obj_type', 'attributes', 'created_at', 'name']:
                    if k not in fields_map:
                        fields_map[k] = {"types": set(), "sample": v}
                    fields_map[k]["types"].add(type(v).__name__)

        # 2. Format for Frontend
        # Define known Dimensions that trigger Hierarchy behavior
        known_dimensions = ['category', 'brand', 'region', 'store_type', 'department']
        
        contract = []
        for k, v in fields_map.items():
            is_dim = k.lower() in known_dimensions
            contract.append({
                "name": k,
                "type": list(v["types"])[0], 
                "required": True,
                "is_dimension": is_dim, # Critical for UI grouping
                "description": f"Inferred {k}. Sample: {v['sample']}"
            })

        return {
            "entity": target_type,
            "field_count": len(contract),
            "fields": contract,
            "status": "LIVE_INFERENCE"
        }

    def save_structure(self, obj_type: str, fields: List[Dict]):
        """
        Allows Frontend to 'Lock' the Data Contract.
        (Currently a placeholder for persistence logic).
        """
        logger.info(f"🔒 [DOMAIN] Contract Locked for {obj_type}: {len(fields)} fields defined.")
        return {"status": "success", "message": "Contract saved."}

    # =========================================================
    # 3. LEGACY COMPATIBILITY LAYER (Preserved)
    # =========================================================

    def get_table(self, level_name: str) -> List[Dict]:
        """Legacy Adapter: Maps 'universal_objects' -> old 'nodes' format."""
        obj_type = level_name
        objects = self.get_objects(obj_type)
        
        adapted = []
        for o in objects:
            row = {
                "node_id": o['obj_id'],
                "name": o.get('name', o['obj_id']),
                "type": o['obj_type'],
                "parent_id": o.get('parent_id'), 
                **{k: v for k, v in o.items() if k not in ['obj_id', 'obj_type', 'name', 'attributes']}
            }
            adapted.append(row)
        return adapted

    def get_metrics(self, limit=100, offset=0, metric_filter=None) -> List[Dict]:
        """Legacy Adapter: Maps 'universal_events' -> old 'node_metrics' format."""
        conn = get_db_connection(self.db_path)
        ph = get_placeholder()
        
        try:
            query = "SELECT * FROM universal_events"
            params = []
            
            if metric_filter and metric_filter != 'TRANSACTIONS':
                query += f" WHERE event_type LIKE {ph}"
                params.append(f"{metric_filter}%")
            
            query += f" ORDER BY timestamp DESC LIMIT {limit} OFFSET {offset}"
            
            # Execute
            if POSTGRES_AVAILABLE and hasattr(conn, 'cursor'):
                from psycopg2.extras import RealDictCursor
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(query, tuple(params))
                    rows = cur.fetchall()
                    rows = [dict(r) for r in rows]
            else:
                rows = conn.execute(query, tuple(params)).fetchall()
                rows = [dict(r) for r in rows]
            
            adapted = []
            for r in rows:
                loc_id = r.get('secondary_target_id')
                adapted.append({
                    "node_id": r['primary_target_id'],
                    "location_id": loc_id,
                    "date": r['timestamp'],
                    "metric_type": r['event_type'],
                    "value": r['value']
                })
            return adapted
        finally:
            conn.close()

    def get_levels(self, tree_type: str = "PRODUCT") -> List[str]:
        if tree_type == "PRODUCT": return ["Category", "SubCategory", "SKU"]
        elif tree_type == "LOCATION": return ["Region", "District", "Store"]
        return ["Level 1", "Level 2"]

    def define_levels(self, levels, tree_type):
        pass 

    def add_node(self, node_id, name, node_type, parent_id=None, scenario="LIVE"):
        conn = get_db_connection(self.db_path)
        ph = get_placeholder()
        try:
            query = f"INSERT INTO universal_objects (obj_id, obj_type, name, attributes) VALUES ({ph},{ph},{ph},{ph})"
            params = (node_id, node_type, name, json.dumps({"parent_id": parent_id}))
            
            if POSTGRES_AVAILABLE and hasattr(conn, 'cursor'):
                 with conn.cursor() as cur:
                    cur.execute(query, params)
                 conn.commit()
            else:
                conn.execute(query, params)
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to add node: {e}")
        finally:
            conn.close()

# Singleton Instance
domain_mgr = DomainManager()
