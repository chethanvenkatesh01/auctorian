import requests
import json
import os
import logging

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("PHYSICS_LAYER")

# POINT THIS TO YOUR BEAST'S LOCAL SERVER
# Docker -> Host machine communication
# [FIX] Switched to NATIVE Ollama endpoint to prevent 404 errors
LOCAL_INFERENCE_URL = os.environ.get("LOCAL_LLM_URL", "http://host.docker.internal:11434/api/chat")

class LocalInferenceAdapter:
    """
    The Sovereign Interface. 
    Routes cognitive tasks to the local silicon (Reflex vs Reflection lanes).
    """

    @staticmethod
    def generate(prompt: str, role: str = "analyst", json_mode: bool = False, system_instruction: str = None) -> str:
        """
        role='analyst'    -> Routes to 8B Model (Fast/Reflex)
        role='strategist' -> Routes to 70B Model (Deep/Reflection)
        """
        
        # 1. Asymmetric Scheduling (The "Split Brain")
        if role == "strategist":
            # If 70b is too heavy, fallback to "llama3"
            model_id = "llama3:70b" 
            options = {"temperature": 0.6}
        else:
            model_id = "llama3"
            options = {"temperature": 0.1}

        default_system = "You are a sovereign component of the Auctorian Decision Engine. Act with precision."
        sys_msg = system_instruction if system_instruction else default_system

        # 2. Construct Payload (NATIVE OLLAMA FORMAT)
        headers = {"Content-Type": "application/json"}
        
        payload = {
            "model": model_id,
            "messages": [
                {"role": "system", "content": sys_msg},
                {"role": "user", "content": prompt}
            ],
            "stream": False,
            "options": options
        }

        if json_mode:
            payload["format"] = "json"

        # 3. Execute on Local Silicon
        try:
            logger.info(f"⚡ [PHYSICS] Sending thought to {model_id} (Role: {role})...")
            response = requests.post(LOCAL_INFERENCE_URL, headers=headers, json=payload, timeout=300)
            
            if response.status_code == 404:
                # Fallback: The user might have a very old Ollama or network issue
                logger.error(f"🔥 [PHYSICS ERROR] 404 Not Found. Check if 'ollama serve' is running.")
                return json.dumps({"error": "Model Not Found", "actions": []})
                
            response.raise_for_status()
            result = response.json()
            
            # Ollama Native Format Response Handling
            content = result.get('message', {}).get('content', '')
            return content
            
        except Exception as e:
            logger.error(f"🔥 [PHYSICS ERROR] GPU Inference Failed: {e}")
            return json.dumps({"error": "Sovereign Compute Node Offline", "rationale": "Hardware Failure", "actions": []})

# Singleton Instance
sovereign_brain = LocalInferenceAdapter()
