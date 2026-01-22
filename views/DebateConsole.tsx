import React, { useState, useEffect } from 'react';
import {
  Users, Gavel, AlertTriangle, ArrowRight,
  MessageSquare, TrendingUp, Shield, DollarSign,
  CheckCircle2, XCircle, BrainCircuit, RefreshCw
} from 'lucide-react';
import { api } from '../services/api';

// --- TYPES ---
interface DebateTicket {
  ticket_id: string;
  node_id: string;
  issue_type: string;
  value: number;
  threshold: number;
  reason: string;
  status: string;
  created_at: string;
}

export const DebateConsole: React.FC = () => {
  const [tickets, setTickets] = useState<DebateTicket[]>([]);
  const [activeTicket, setActiveTicket] = useState<DebateTicket | null>(null);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch tickets on mount and periodically
  useEffect(() => {
    loadTickets();
    const interval = setInterval(loadTickets, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const data = await api.debate.getTickets();
      setTickets(data.tickets || []);

      // Auto-select first ticket if none selected
      if (!activeTicket && data.tickets?.length > 0) {
        setActiveTicket(data.tickets[0]);
      }
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (approved: boolean) => {
    if (!activeTicket) return;

    setResolving(true);
    try {
      await api.debate.resolveTicket(activeTicket.ticket_id, approved);
      await loadTickets(); // Refresh list
      setActiveTicket(null); // Clear selection
    } catch (e: any) {
      setError(e.message || 'Failed to resolve ticket');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden">

      {/* --- LEFT PANEL: TICKET QUEUE --- */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={18} />
            Active Conflicts
            <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">{tickets.length}</span>
          </h2>
          {error && (
            <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
              {error}
            </div>
          )}
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
              <RefreshCw className="animate-spin" size={16} /> Scanning conflicts...
            </div>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              <CheckCircle2 size={48} className="mx-auto mb-2 text-emerald-400" />
              System Nominal. No conflicts detected.
            </div>
          ) : (
            tickets.map(ticket => (
              <button
                key={ticket.ticket_id}
                onClick={() => setActiveTicket(ticket)}
                className={`w-full text-left p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors ${activeTicket?.ticket_id === ticket.ticket_id ? 'bg-indigo-50/50 border-l-4 border-l-indigo-500' : 'border-l-4 border-l-transparent'
                  }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-slate-700 text-sm">{ticket.issue_type}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600">
                    BLOCKED
                  </span>
                </div>
                <div className="text-xs text-slate-600 font-mono mb-1">
                  SKU: {ticket.node_id}
                </div>
                <div className="text-xs text-slate-500 line-clamp-2">
                  {ticket.reason}
                </div>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
                  <span>{new Date(ticket.created_at).toLocaleString()}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* --- CENTER PANEL: TICKET DETAILS & RESOLUTION --- */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50">
        {activeTicket ? (
          <>
            {/* HEADER */}
            <div className="p-6 bg-white border-b border-slate-200 shadow-sm">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                      {activeTicket.issue_type}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {activeTicket.ticket_id}
                    </span>
                  </div>
                  <h1 className="text-xl font-black text-slate-900 mb-2">
                    Decision Blocked: {activeTicket.node_id}
                  </h1>
                  <p className="text-sm text-slate-600">
                    {activeTicket.reason}
                  </p>
                </div>
              </div>
            </div>

            {/* DETAILS */}
            <div className="flex-1 p-8 overflow-y-auto">
              <div className="max-w-3xl space-y-6">

                {/* Conflict Summary Card */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Shield size={18} className="text-amber-500" />
                    Conflict Summary
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm font-semibold text-slate-600">Proposed Action</span>
                      <span className="text-sm font-mono font-bold text-slate-900">
                        {activeTicket.issue_type} → {activeTicket.value} units
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm font-semibold text-slate-600">Threshold Violated</span>
                      <span className="text-sm font-mono font-bold text-red-600">
                        ${activeTicket.threshold}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm font-semibold text-slate-600">Requested At</span>
                      <span className="text-sm text-slate-700">
                        {new Date(activeTicket.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Resolution Actions */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-6">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Gavel size={18} className="text-indigo-600" />
                    Human Override Required
                  </h3>
                  <p className="text-sm text-slate-600 mb-6">
                    This decision has been escalated to System 2 (Human Judgment) because it violated profit guardrails.
                    Review the context and approve or reject the proposed action.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleResolve(false)}
                      disabled={resolving}
                      className="flex-1 py-3 bg-white border-2 border-red-300 text-red-700 hover:bg-red-50 rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <XCircle size={18} />
                      {resolving ? 'Processing...' : 'Reject'}
                    </button>
                    <button
                      onClick={() => handleResolve(true)}
                      disabled={resolving}
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {resolving ? (
                        <>
                          <RefreshCw size={18} className="animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={18} />
                          Approve & Execute
                        </>
                      )}
                    </button>
                  </div>
                  {resolving && (
                    <p className="mt-3 text-xs text-slate-500 text-center">
                      Forwarding approved decision to Auctobot execution queue...
                    </p>
                  )}
                </div>

                {/* Impact Analysis */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-4">Decision Impact</h3>
                  <div className="text-sm text-slate-600 space-y-2">
                    <p>
                      <strong>If Approved:</strong> The decision will be queued in Auctobot and executed
                      after batch authorization. The system will record the transaction to the ledger.
                    </p>
                    <p>
                      <strong>If Rejected:</strong> The decision will be permanently blocked and
                      recorded in the audit log. The orchestrator will not attempt this action again.
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <MessageSquare size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold">No Ticket Selected</p>
              <p className="text-sm">Select a conflict from the left panel to review</p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
