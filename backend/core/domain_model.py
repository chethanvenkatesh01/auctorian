import json
import logging
from typing import List, Dict, Optional, Any
# IMPORTS FROM THE NEW SHARED SCHEMA MODULE
from .sql_schema import init_db, get_db_connection, get_placeholder, POSTGRES_AVAILABLE

logger = logging.getLogger("DOMAIN_MANAGER")

class DomainManager:
    """
    Guardian of the Universal Graph (v4.0 - Polyglot).
    Manages the flexible Ontology (Objects, Events, Relationships).
    Supports both SQLite (Dev) and Postgres (Prod).
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
            # Postgres creates indices differently, but standard SQL usually works.
            # We wrap in try/except to be safe across dialects.
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
    # 1. UNIVERSAL GRAPH API
    # =========================================================

    def get_objects(self, obj_type: str) -> List[Dict]:
        """Fetches Nouns (Products, Locations) from the Universal Store."""
        conn = get_db_connection(self.db_path)
        ph = get_placeholder() # ? or %s
        
        try:
            # Unified Query Execution
            if POSTGRES_AVAILABLE and hasattr(conn, 'cursor'):
                # Postgres (RealDictCursor behavior)
                from psycopg2.extras import RealDictCursor
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(f"SELECT * FROM universal_objects WHERE obj_type = {ph}", (obj_type,))
                    rows = cur.fetchall()
                    # Convert RealDictRow to dict
                    results = [dict(r) for r in rows]
            else:
                # SQLite (Row factory behavior)
                rows = conn.execute(f"SELECT * FROM universal_objects WHERE obj_type = {ph}", (obj_type,)).fetchall()
                results = [dict(r) for r in rows]

            # JSON Parsing
            final_list = []
            for item in results:
                if item.get('attributes'):
                    try:
                        # Postgres JSONB might already be a dict, SQLite is string
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
    # 2. LEGACY COMPATIBILITY LAYER
    # =========================================================

    def get_table(self, level_name: str) -> List[Dict]:
        """Legacy Adapter: Maps 'universal_objects' -> old 'nodes' format."""
        obj_type = level_name
        objects = self.get_objects(obj_type)
        
        adapted = []
        for o in objects:
            row = {
                "node_id": o['obj_id'],
                "name": o['name'],
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
