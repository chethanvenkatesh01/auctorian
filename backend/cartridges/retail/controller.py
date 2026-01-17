import os
import json
import logging
import asyncio
from typing import Dict, Any, List, Optional
from core.schema import ConstraintEnvelope
# THE SOVEREIGN ADAPTER (Replaces Google Gemini)
from core.local_llm import sovereign_brain

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("RETAIL_CARTRIDGE")

# --- AUCTORIAN V6.1 COMPONENT: RETAIL CARTRIDGE (Sovereign Edition) ---
# Features:
# 1. Asymmetric Inference (8B Reflex vs 70B Reflection).
# 2. Local Context Hydration (FeasibilityAdapter).
# 3. Governance-First Architecture.

class FeasibilityAdapter:
    """
    The Sensory Organ. 
    Manages the 'State of the World' (Inventory, Pricing, Sales).
    Reads from local retail_db.json.
    """
    def __init__(self, data_path="data/retail_db.json"):
        self.data_path = data_path
        self._cache = {}
        self._load_data()

    def _load_data(self):
        try:
            # ROBUST PATH RESOLUTION
            current_dir = os.getcwd() # In Docker, this is /app
            
            # Check 1: Direct path (Docker /app/data/retail_db.json)
            path_1 = os.path.join(current_dir, self.data_path)
            
            # Check 2: Nested path (Local Dev backend/data/retail_db.json)
            path_2 = os.path.join(current_dir, 'backend', self.data_path)
            
            full_path = ""
            if os.path.exists(path_1):
                full_path = path_1
            elif os.path.exists(path_2):
                full_path = path_2
            else:
                # Fallback: absolute lookup assuming repo structure
                full_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../data/retail_db.json'))

            if os.path.exists(full_path):
                with open(full_path, 'r') as f:
                    self._cache = json.load(f)
                logger.info(f"[FEASIBILITY] Hydrated {len(self._cache.get('products', []))} records from {full_path}")
            else:
                logger.warning(f"[FEASIBILITY] Database NOT found. Checked: {path_1}, {path_2}. Running empty.")
                self._cache = {}
        except Exception as e:
            logger.error(f"[FEASIBILITY] Hydration Failed: {e}")
            self._cache = {}


class RetailCartridge:
    def __init__(self):
        # Initialize the Local Sensory Organ
        self.feasibility = FeasibilityAdapter()

    def assess_complexity(self, payload: Dict[str, Any]) -> str:
        """
        The Traffic Cop.
        Decides if this needs the 'Reflex Lane' (8B) or 'Reflection Lane' (70B).
        """
        msg_type = payload.get("type", "unknown")
        # Complex tasks require the Strategist (70B)
        if msg_type in ["pricing_markdown", "assortment_planning", "scenario_simulation"]:
            return "high"
        # Simple queries use the Analyst (8B)
        return "low"

    async def deliberate(self, payload: Dict[str, Any], constraints: ConstraintEnvelope) -> Dict:
        """
        System 2: The Virtual Boardroom (Runs on Sovereign Silicon).
        Orchestrates the debate between Analyst (Facts) and Strategist (Reasoning).
        """
        logger.info(f"[SOVEREIGN BOARDROOM] Session Started for: {payload.get('type')}")
        
        # --- ROUND 1: THE ANALYST (Reflex Lane - 8B) ---
        # Gathers facts. Fast. Low temperature.
        analyst_context = await self._agent_analyst_gather(payload, constraints)
        logger.info(f"[BOARDROOM] Analyst Brief: {analyst_context[:100]}...")

        # --- ROUND 2: THE STRATEGIST (Reflection Lane - 70B) ---
        # Thinks deeply. Simulates outcomes. High temperature (creative).
        strategist_proposal = await self._agent_strategist_plan(payload, analyst_context, constraints)
        logger.info(f"[BOARDROOM] Strategist Proposal: {strategist_proposal.get('rationale')[:100]}...")

        # --- ROUND 3: THE AUDITOR (Reflex Lane - 8B) ---
        # Checks against constraints. Strict. Zero tolerance.
        final_decision = await self._agent_analyst_critique(strategist_proposal, constraints)
        
        return final_decision

    async def execute_reflex(self, payload: Dict[str, Any]) -> Dict:
        """System 1: Fast Reflex Action (8B Only)"""
        prompt = f"Quickly resolve retail query: {json.dumps(payload)}"
        # Direct call to Analyst (Reflex Lane)
        response = sovereign_brain.generate(prompt, role="analyst")
        return {"action": "reflex_response", "content": response}

    # --- AGENTIC WORKFLOWS (The "Profession" Layer) ---

    async def _agent_analyst_gather(self, payload: Dict, constraints: ConstraintEnvelope) -> str:
        """
        Role: Senior Retail Analyst
        Model: Llama-3-8B (Reflex)
        Task: Fetch data, summarize current state, identify gaps.
        """
        sku = payload.get("sku") or payload.get("target", "Unknown")
        live_data = self.feasibility.get_sku_context(sku)
        
        prompt = f"""
        DATA CONTEXT: {json.dumps(live_data)}
        USER REQUEST: {json.dumps(payload)}
        
        TASK: Summarize the inventory health, margin performance, and competitive gaps for this item.
        Be purely factual. Do not propose solutions yet.
        """
        
        return sovereign_brain.generate(
            prompt, 
            role="analyst", 
            system_instruction="You are a Senior Retail Analyst. Stick strictly to the provided data. Be concise."
        )

    async def _agent_strategist_plan(self, payload: Dict, analyst_brief: str, constraints: ConstraintEnvelope) -> Dict:
        """
        Role: Chief Merchant / Strategist
        Model: Llama-3-70B (Reflection)
        Task: Optimize GMROI, simulate pricing scenarios, propose actions.
        """
        prompt = f"""
        ANALYST BRIEF: {analyst_brief}
        
        CONSTRAINTS: 
        - Budget Cap: {constraints.budget_cap}
        - Risk Tolerance: {constraints.risk_tolerance}
        
        OBJECTIVE: Maximize GMROI (Gross Margin Return on Investment).
        
        TASK: Propose a decision plan. 
        OUTPUT SCHEMA (JSON):
        {{
            "rationale": "Detailed strategic reasoning...",
            "actions": [{{"action": "markdown|transfer|reorder", "params": {{...}}}}]
        }}
        """
        
        response_text = sovereign_brain.generate(
            prompt, 
            role="strategist", 
            json_mode=True, 
            system_instruction="You are the Chief Merchant. Think deeply. Optimize for long-term profit. Output valid JSON."
        )
        return self._clean_json(response_text)

    async def _agent_analyst_critique(self, proposal: Dict, constraints: ConstraintEnvelope) -> Dict:
        """
        Role: Governance Auditor
        Model: Llama-3-8B (Reflex)
        Task: Safety check. Ensure no constraint violations.
        """
        prompt = f"""
        PROPOSED PLAN: {json.dumps(proposal)}
        
        GOVERNANCE CONSTRAINTS:
        - Budget Cap: {constraints.budget_cap}
        - Risk Tolerance: {constraints.risk_tolerance}
        
        TASK: 
        1. Check if the plan violates any constraints.
        2. If SAFE, return the plan as-is.
        3. If UNSAFE, modify the 'actions' to be compliant (e.g., reduce quantities).
        
        OUTPUT SCHEMA (JSON): Same as input.
        """
        
        response_text = sovereign_brain.generate(
            prompt, 
            role="analyst", 
            json_mode=True, 
            system_instruction="You are the Governance Auditor. Zero tolerance for risk violations. Output valid JSON."
        )
        return self._clean_json(response_text)

    def _clean_json(self, text: str) -> Dict:
        """Sanitizes LLM output to ensure valid JSON."""
        try:
            # Strip markdown code blocks if present
            clean_text = text.replace("```json", "").replace("```", "").strip()
            return json.loads(clean_text)
        except json.JSONDecodeError:
            logger.error(f"[SOVEREIGN] JSON Parse Error: {text}")
            return {
                "rationale": "Sovereign Compute Node failed to structure the response.",
                "actions": []
            }
