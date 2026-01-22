import React, { useEffect, useRef, useState } from 'react';
import { X, Terminal, CheckCircle, Circle, AlertTriangle, Play, RefreshCw, Server, Shield, Package, Clock } from 'lucide-react';
import { api } from '../services/api';

interface AuctobotConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DecisionPackage {
  id: string;
  timestamp: string;
  action: string;
  target_id: string;
  quantity: number;
  reason: string;
  status: string;
  hash: string;
}

const AuctobotConsole: React.FC<AuctobotConsoleProps> = ({ isOpen, onClose }) => {
  const [queue, setQueue] = useState<DecisionPackage[]>([]);
  const [history, setHistory] = useState<DecisionPackage[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchQueueData = async () => {
    try {
      const data = await api.agency.getQueue();
      setQueue(data.queue || []);
      setHistory(data.history || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch queue data');
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchQueueData();
      const interval = setInterval(fetchQueueData, 5000); // Poll every 5s
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleExecute = async () => {
    if (queue.length === 0) return;

    setIsExecuting(true);
    try {
      await api.agency.execute();
      await fetchQueueData(); // Refresh after execution
    } catch (err: any) {
      setError(err.message || 'Execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 w-full max-w-5xl rounded-xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-slate-950 p-4 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 bg-indigo-600 rounded flex items-center justify-center">
              <Terminal className="text-white" size={18} />
            </div>
            <div>
              <h3 className="font-bold text-white">Auctobot Decision Queue</h3>
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-emerald-400 flex items-center">
                  <Circle size={6} fill="currentColor" className="mr-1" /> Online
                </span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-400">{queue.length} Pending</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="bg-red-900/20 border-b border-red-800 p-3 text-red-400 text-sm flex items-center gap-2">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {/* Queue Section */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-slate-200 font-bold flex items-center gap-2">
              <Package size={18} className="text-amber-400" />
              Pending Execution ({queue.length})
            </h4>
            <button
              onClick={handleExecute}
              disabled={queue.length === 0 || isExecuting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-bold text-sm flex items-center gap-2 transition-colors"
            >
              {isExecuting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> Executing...
                </>
              ) : (
                <>
                  <Play size={16} /> AUTHORIZE BATCH
                </>
              )}
            </button>
          </div>

          {queue.length === 0 ? (
            <div className="text-center text-slate-500 py-8 bg-slate-800/30 rounded-lg">
              No pending decisions. Queue is empty.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {queue.map((pkg) => (
                <div key={pkg.id} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 hover:border-amber-500/50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-amber-900/30 text-amber-400 text-xs font-bold rounded">
                        {pkg.action}
                      </span>
                      <span className="text-slate-400 text-xs font-mono">{pkg.id}</span>
                    </div>
                    <span className="text-xs text-slate-500">{new Date(pkg.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-sm text-slate-300">
                    Target: <span className="font-mono text-indigo-400">{pkg.target_id}</span>
                    <span className="mx-2 text-slate-600">|</span>
                    Qty: <span className="text-emerald-400 font-bold">{pkg.quantity}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{pkg.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* History Section */}
        <div className="flex-1 p-4 overflow-hidden flex flex-col">
          <h4 className="text-slate-200 font-bold flex items-center gap-2 mb-3">
            <Clock size={18} className="text-blue-400" />
            Execution History
          </h4>
          <div className="flex-1 bg-black/40 p-4 overflow-y-auto font-mono text-sm rounded-lg" ref={scrollRef}>
            <div className="space-y-1">
              {history.length === 0 ? (
                <div className="text-slate-600 text-center py-8">No execution history yet.</div>
              ) : (
                history.map((pkg) => (
                  <div key={pkg.id} className="flex space-x-3 items-start hover:bg-white/5 p-1 rounded">
                    <span className="text-slate-500 shrink-0 text-xs">
                      [{new Date(pkg.timestamp).toLocaleTimeString()}]
                    </span>
                    <span className={`font-bold shrink-0 w-20 text-xs ${pkg.status === 'EXECUTED' ? 'text-emerald-400' :
                        pkg.status === 'FAILED' ? 'text-red-400' : 'text-amber-400'
                      }`}>
                      {pkg.action}
                    </span>
                    <div className="flex-1 text-xs">
                      <span className="text-slate-300">{pkg.target_id}</span>
                      <span className="text-slate-600 mx-2">→</span>
                      <span className="text-slate-400">{pkg.quantity}</span>
                    </div>
                    <div>
                      {pkg.status === 'EXECUTED' && <span className="text-emerald-500 text-xs">✓ OK</span>}
                      {pkg.status === 'FAILED' && <span className="text-red-500 text-xs">✗ ERR</span>}
                      {pkg.status === 'PENDING' && <span className="text-amber-400 text-xs animate-pulse">...</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuctobotConsole;
