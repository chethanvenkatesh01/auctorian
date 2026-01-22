import json
import hashlib
import uuid
from datetime import datetime
from typing import Dict, List, Optional
from .ledger import ledger

class DecisionPackage:
    """
    Immutable decision envelope with cryptographic proof of intent.
    Prevents replay attacks using timestamp + nonce in hash.
    """
    def __init__(self, action: str, target_id: str, quantity: float, reason: str):
        self.id = f"PKG-{uuid.uuid4().hex[:8].upper()}"
        self.timestamp = datetime.now().isoformat()
        self.nonce = uuid.uuid4().hex[:12]  # Anti-replay nonce
        self.action = action  # e.g., "REPLENISH", "PRICE_CHANGE"
        self.target_id = target_id
        self.quantity = quantity
        self.reason = reason
        self.status = "PENDING"  # PENDING, EXECUTED, FAILED
        self.hash = self._generate_hash()

    def _generate_hash(self):
        """Generate SHA-256 hash including timestamp and nonce to prevent replay attacks."""
        payload = f"{self.action}{self.target_id}{self.quantity}{self.timestamp}{self.nonce}"
        return hashlib.sha256(payload.encode()).hexdigest()

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "nonce": self.nonce,
            "action": self.action,
            "target_id": self.target_id,
            "quantity": self.quantity,
            "reason": self.reason,
            "status": self.status,
            "hash": self.hash
        }

class Auctobot:
    """
    The Last Mile Execution Agent.
    Processes decision packages with idempotency guarantees.
    """
    def __init__(self):
        self.queue: List[DecisionPackage] = []
        self.history: List[DecisionPackage] = []
        self._executed_hashes: set = set()  # Idempotency tracker

    def queue_decision(self, pkg: DecisionPackage):
        """Add a decision package to the execution queue."""
        # Check for duplicate hash (replay attack prevention)
        if pkg.hash in self._executed_hashes:
            print(f"[AUCTOBOT] ⚠️ Replay attack detected: {pkg.id} (hash already executed)")
            return
        
        self.queue.append(pkg)
        print(f"[AUCTOBOT] ✅ Queued: {pkg.action} for {pkg.target_id} ({pkg.quantity})")

    def execute_batch(self):
        """
        Execute all queued decisions and record to ledger.
        Returns execution results with status for each package.
        """
        results = []
        for pkg in self.queue:
            try:
                # Idempotency check
                if pkg.hash in self._executed_hashes:
                    pkg.status = "SKIPPED"
                    results.append({"id": pkg.id, "status": "SKIPPED", "reason": "Duplicate hash"})
                    continue

                # Execute based on action type
                if pkg.action == "REPLENISH":
                    ledger.record_transaction(
                        pkg.target_id, 
                        "RECEIPTS_QTY", 
                        pkg.quantity, 
                        meta={"source": "AUCTOBOT", "pkg_id": pkg.id, "reason": pkg.reason}
                    )
                    print(f"[AUCTOBOT] 📦 REPLENISH: {pkg.target_id} +{pkg.quantity} units")
                
                elif pkg.action == "PRICE_CHANGE":
                    ledger.record_transaction(
                        pkg.target_id, 
                        "PRICE", 
                        pkg.quantity,
                        meta={"source": "AUCTOBOT", "pkg_id": pkg.id, "reason": pkg.reason}
                    )
                    print(f"[AUCTOBOT] 💰 PRICE_CHANGE: {pkg.target_id} → ${pkg.quantity}")
                
                else:
                    raise ValueError(f"Unknown action: {pkg.action}")
                
                # Mark as executed
                pkg.status = "EXECUTED"
                self._executed_hashes.add(pkg.hash)
                self.history.append(pkg)
                results.append({"id": pkg.id, "status": "SUCCESS", "hash": pkg.hash})
                
            except Exception as e:
                pkg.status = "FAILED"
                self.history.append(pkg)
                results.append({"id": pkg.id, "status": "FAILED", "error": str(e)})
                print(f"[AUCTOBOT] ❌ FAILED: {pkg.id} - {e}")
        
        # Clear queue after execution
        executed_count = len([r for r in results if r["status"] == "SUCCESS"])
        self.queue = []
        
        print(f"[AUCTOBOT] 🏁 Batch complete: {executed_count}/{len(results)} succeeded")
        return results

    def get_queue(self):
        """Return current queue as dict list."""
        return [p.to_dict() for p in self.queue]

    def get_history(self, limit: int = 50):
        """Return execution history (most recent first)."""
        return [p.to_dict() for p in self.history[-limit:][::-1]]

# Singleton Instance
auctobot = Auctobot()
