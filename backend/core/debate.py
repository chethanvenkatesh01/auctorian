import os
import json
import uuid
from datetime import datetime
import google.generativeai as genai
from typing import Dict, Any, List
from .sql_schema import get_db_connection, get_placeholder, POSTGRES_AVAILABLE

class DebateEngine:
    """
    System 3: The Multi-Modal Council of Agents.
    Simulates domain-specific boardroom debates for ambiguous decisions.
    Now with persistent ticket storage for conflict resolution.
    """
    
    def __init__(self, db_path="ados_ledger.db"):
        self.db_path = db_path
        self.api_key = os.environ.get("GEMINI_API_KEY")
        self.model = None
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel('gemini-pro')
        else:
            print("[DEBATE] WARNING: No Gemini API Key. System 3 disabled.")

    def _get_personas(self, mode: str):
        """Returns the specific conflict agents for the given module."""
        matrix = {
            'REPLENISHMENT': {
                'A': {'role': 'VP of Sales', 'goal': 'Maximize Revenue & Availability (Never Stock Out)'},
                'B': {'role': 'CFO', 'goal': 'Preserve Cash Flow & Prevent Overstock'},
                'Judge': {'role': 'CEO', 'goal': 'Balance Growth with Solvency'}
            },
            'PRICING': {
                'A': {'role': 'Chief Revenue Officer', 'goal': 'Maximize Margin % and Yield'},
                'B': {'role': 'Customer Loyalty Director', 'goal': 'Prevent Churn & Protect Price Perception'},
                'Judge': {'role': 'Chief Commercial Officer', 'goal': 'Sustainable Profitability'}
            },
            'MARKDOWN': {
                'A': {'role': 'Inventory Controller', 'goal': 'Clear Dead Stock Immediately (Cash Recovery)'},
                'B': {'role': 'Brand Guardian', 'goal': 'Protect Brand Equity (Avoid Cheap Perception)'},
                'Judge': {'role': 'Merchandising Director', 'goal': 'Clean Exit Strategy'}
            },
            'ASSORTMENT': {
                'A': {'role': 'Efficiency Expert', 'goal': 'Rationalize SKU Count (Kill Low Performers)'},
                'B': {'role': 'Trend Hunter', 'goal': 'Maintain Strategic/Halo Items regardless of volume'},
                'Judge': {'role': 'Head of Product', 'goal': 'Curated & Profitable Mix'}
            },
            'ALLOCATION': {
                'A': {'role': 'Retail Operations', 'goal': 'Maximize On-Shelf Availability in All Stores'},
                'B': {'role': 'Logistics Manager', 'goal': 'Minimize Split Shipments & Transport Costs'},
                'Judge': {'role': 'COO', 'goal': 'Efficient Service Level'}
            }
        }
        return matrix.get(mode, matrix['REPLENISHMENT'])

    def convene_council(self, context: Dict[str, Any], mode: str = 'REPLENISHMENT') -> Dict[str, Any]:
        """
        Orchestrates the debate based on the mode.
        """
        if not self.model:
            return {"decision": "HOLD", "rationale": "AI Offline", "transcript": []}

        # 1. Setup Personas
        personas = self._get_personas(mode)
        item = context.get('name', 'Unknown Item')
        data_summary = f"Stats: {json.dumps(context.get('stats', {}))}"
        
        print(f"[DEBATE] Convening {mode} Council for {item}...")

        # 2. Agent A Argues (The Hawk)
        prompt_a = f"""
        You are the {personas['A']['role']}. Your goal: {personas['A']['goal']}.
        Context: Item '{item}'. {data_summary}.
        Situation: We need to make a bold move. 
        Task: Write 2 sentences arguing WHY we should take aggressive action (Buy More / Hike Price / Slash Price).
        """
        arg_a = self._invoke_agent(prompt_a)

        # 3. Agent B Argues (The Dove)
        prompt_b = f"""
        You are the {personas['B']['role']}. Your goal: {personas['B']['goal']}.
        Context: Item '{item}'. {data_summary}.
        Opposing View: "{arg_a}"
        Task: Write 2 sentences arguing WHY we should be conservative (Hold / Keep Price / Keep Item). 
        Critique the risk of the aggressive move.
        """
        arg_b = self._invoke_agent(prompt_b)

        # 4. The Judge Decides
        prompt_judge = f"""
        You are the {personas['Judge']['role']}. Goal: {personas['Judge']['goal']}.
        
        Item: {item}
        Data: {data_summary}
        
        Argument A ({personas['A']['role']}): "{arg_a}"
        Argument B ({personas['B']['role']}): "{arg_b}"
        
        Task: Issue a binding verdict.
        1. Action: Choose one (ACTION or HOLD).
        2. Modification: If ACTION, specify the % or Quantity (e.g., "Hike 3% instead of 5%" or "Buy 50 units").
        3. Rationale: Summarize why in 1 sentence.
        
        Return ONLY valid JSON: {{ "decision": "ACTION|HOLD", "value": <number>, "rationale": "<text>" }}
        """
        raw_verdict = self._invoke_agent(prompt_judge)
        
        # 5. Parse
        try:
            clean_json = raw_verdict.replace('```json', '').replace('```', '').strip()
            verdict = json.loads(clean_json)
            
            return {
                "decision": verdict.get("decision", "HOLD"),
                "value": verdict.get("value", 0),
                "rationale": verdict.get("rationale", "Council Deadlock"),
                "transcript": [
                    {"agent": personas['A']['role'], "arg": arg_a},
                    {"agent": personas['B']['role'], "arg": arg_b},
                    {"agent": personas['Judge']['role'], "verdict": verdict.get("rationale")}
                ]
            }
        except:
            return {"decision": "HOLD", "rationale": "Council Mistrial", "transcript": []}

    def _invoke_agent(self, prompt: str) -> str:
        try:
            return self.model.generate_content(prompt).text.strip()
        except:
            return "..."

    # =========================================================
    # TICKET PERSISTENCE SYSTEM
    # =========================================================
    
    def create_ticket(self, node_id: str, issue_type: str, value: float, threshold: float, reason: str) -> Dict:
        """
        Creates a persistent conflict ticket in the database.
        Called when validator rejects a decision.
        """
        ticket_id = f"TKT-{uuid.uuid4().hex[:8].upper()}"
        conn = get_db_connection(self.db_path)
        ph = get_placeholder()
        
        try:
            query = f"""
                INSERT INTO debate_tickets 
                (ticket_id, node_id, issue_type, value, threshold, reason, status, created_at)
                VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
            """
            params = (
                ticket_id, node_id, issue_type, value, threshold, reason, 
                'ACTIVE', datetime.now().isoformat()
            )
            
            if POSTGRES_AVAILABLE and hasattr(conn, 'cursor'):
                with conn.cursor() as cur:
                    cur.execute(query, params)
                conn.commit()
            else:
                conn.execute(query, params)
                conn.commit()
            
            print(f"[DEBATE] 🎫 Ticket Created: {ticket_id} - {issue_type} for {node_id}")
            return {"ticket_id": ticket_id, "status": "created"}
            
        except Exception as e:
            print(f"[DEBATE] ❌ Failed to create ticket: {e}")
            return {"error": str(e)}
        finally:
            conn.close()
    
    def get_active_tickets(self) -> List[Dict]:
        """
        Returns all active (unresolved) conflict tickets.
        """
        conn = get_db_connection(self.db_path)
        ph = get_placeholder()
        
        try:
            query = f"SELECT * FROM debate_tickets WHERE status = {ph} ORDER BY created_at DESC"
            
            if POSTGRES_AVAILABLE and hasattr(conn, 'cursor'):
                from psycopg2.extras import RealDictCursor
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(query, ('ACTIVE',))
                    rows = cur.fetchall()
                    return [dict(r) for r in rows]
            else:
                rows = conn.execute(query, ('ACTIVE',)).fetchall()
                return [dict(r) for r in rows]
                
        except Exception as e:
            print(f"[DEBATE] ❌ Failed to fetch tickets: {e}")
            return []
        finally:
            conn.close()
    
    def resolve_ticket(self, ticket_id: str, approved: bool) -> Dict:
        """
        Resolves a conflict ticket.
        If approved, forwards decision to Auctobot via DecisionPackage.
        """
        conn = get_db_connection(self.db_path)
        ph = get_placeholder()
        
        try:
            # 1. Fetch ticket details
            query = f"SELECT * FROM debate_tickets WHERE ticket_id = {ph}"
            
            if POSTGRES_AVAILABLE and hasattr(conn, 'cursor'):
                from psycopg2.extras import RealDictCursor
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(query, (ticket_id,))
                    ticket = cur.fetchone()
            else:
                ticket = conn.execute(query, (ticket_id,)).fetchone()
            
            if not ticket:
                return {"error": "Ticket not found"}
            
            ticket_dict = dict(ticket)
            verdict = "APPROVED" if approved else "REJECTED"
            pkg_id = None
            
            # 2. If approved, create DecisionPackage and queue to Auctobot
            if approved:
                try:
                    from .agency import auctobot, DecisionPackage
                    
                    # Map issue_type to action
                    action_map = {
                        "REPLENISHMENT": "REPLENISH",
                        "PRICING": "PRICE_CHANGE",
                        "PROFIT_GUARD": "REPLENISH"  # Fallback
                    }
                    action = action_map.get(ticket_dict['issue_type'], "REPLENISH")
                    
                    pkg = DecisionPackage(
                        action=action,
                        target_id=ticket_dict['node_id'],
                        quantity=ticket_dict['value'],
                        reason=f"DEBATE APPROVED: {ticket_dict['reason']}"
                    )
                    
                    auctobot.queue_decision(pkg)
                    pkg_id = pkg.id
                    print(f"[DEBATE] ✅ Approved: {ticket_id} → Queued as {pkg_id}")
                    
                except Exception as e:
                    print(f"[DEBATE] ⚠️ Could not queue to Auctobot: {e}")
            else:
                print(f"[DEBATE] ❌ Rejected: {ticket_id}")
            
            # 3. Update ticket status
            update_query = f"""
                UPDATE debate_tickets 
                SET status = {ph}, resolved_at = {ph}, resolution_verdict = {ph}, pkg_id = {ph}
                WHERE ticket_id = {ph}
            """
            update_params = (
                'RESOLVED', datetime.now().isoformat(), verdict, pkg_id, ticket_id
            )
            
            if POSTGRES_AVAILABLE and hasattr(conn, 'cursor'):
                with conn.cursor() as cur:
                    cur.execute(update_query, update_params)
                conn.commit()
            else:
                conn.execute(update_query, update_params)
                conn.commit()
            
            return {
                "ticket_id": ticket_id,
                "verdict": verdict,
                "pkg_id": pkg_id,
                "status": "resolved"
            }
            
        except Exception as e:
            print(f"[DEBATE] ❌ Failed to resolve ticket: {e}")
            return {"error": str(e)}
        finally:
            conn.close()

debate_engine = DebateEngine()
