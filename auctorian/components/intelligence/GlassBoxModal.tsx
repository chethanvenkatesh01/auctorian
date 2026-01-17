import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  Brain,
  GitGraph,
  CheckCircle2,
  Clock,
  Fingerprint
} from 'lucide-react';

interface GlassBoxProps {
  open: boolean;
  onClose: () => void;
  skuId: string | null;
}

interface AuditLog {
  run_id: string;
  generated_at: string;
  data_health: {
    score: number;
    log: string[];
  };
  model_transparency: {
    features_used: string[];
    tournament_scoreboard: Record<string, number> | string; // Handle legacy string case
  };
  drivers: Record<string, number>;
}

export const GlassBoxModal: React.FC<GlassBoxProps> = ({ open, onClose, skuId }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AuditLog | null>(null);

  useEffect(() => {
    if (open && skuId) {
      fetchExplanation(skuId);
    }
  }, [open, skuId]);

  const fetchExplanation = async (id: string) => {
    setLoading(true);
    try {
        const result = await api.ml.getForecastExplanation(id);
        // Safety check for empty result
        if (result && result.run_id) {
            setData(result);
        } else {
            setData(null);
        }
    } catch (e) {
        console.error("Failed to fetch explanation", e);
        setData(null);
    }
    setLoading(false);
  };

  // Safe parsing for scoreboard
  const getScoreboard = () => {
    if (!data?.model_transparency?.tournament_scoreboard) return {};
    const sb = data.model_transparency.tournament_scoreboard;
    // If it came back as a JSON string by mistake, parse it
    if (typeof sb === 'string') {
        try { return JSON.parse(sb); } catch { return {}; }
    }
    return sb;
  };
  
  const scoreboard = getScoreboard();
  const winnerName = scoreboard['Winner'] || 'Unknown';

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* BACKDROP */}
      <div 
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* SLIDE-OVER PANEL */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-slate-200">
        
        {/* HEADER */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
            <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Brain className="text-indigo-600" size={20} />
                    Glass Box Inspector
                </h2>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-mono">
                    <span>AUDIT TARGET:</span>
                    <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded font-bold">{skuId}</span>
                </div>
            </div>
            <button 
                onClick={onClose}
                className="p-2 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
            >
                <X size={20} />
            </button>
        </div>

        {/* CONTENT SCROLL AREA */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white custom-scrollbar">
            
            {loading && (
                <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-60">
                    <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                    <p className="text-sm font-medium text-slate-500">Decrypting Model Logic...</p>
                </div>
            )}

            {!loading && !data && (
                <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-start gap-3">
                    <TrendingUp size={20} />
                    <div>
                        <p className="text-sm font-bold">No Audit Log Found</p>
                        <p className="text-xs mt-1">Run the Intelligence Pipeline to generate a new Glass Box explanation for this SKU.</p>
                    </div>
                </div>
            )}

            {!loading && data && (
                <>
                    {/* 1. DATA HEALTH CARD */}
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <ShieldCheck size={16} className={data.data_health.score > 80 ? "text-emerald-500" : "text-amber-500"} />
                                Data Health
                            </h3>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                                data.data_health.score > 80 
                                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200" 
                                    : "bg-amber-100 text-amber-700 border border-amber-200"
                            }`}>
                                {data.data_health.score}/100
                            </span>
                        </div>
                        
                        <div className="space-y-2">
                            {data.data_health.log.length === 0 ? (
                                <p className="text-xs text-slate-400 italic pl-6">No data quality issues detected.</p>
                            ) : (
                                data.data_health.log.map((entry, idx) => (
                                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-600 bg-white p-2 rounded border border-slate-100">
                                        <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                                        <span>{entry}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* 2. TOURNAMENT RESULTS */}
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                            <GitGraph size={16} className="text-indigo-600" />
                            <h3 className="text-sm font-bold text-slate-900">Model Tournament</h3>
                        </div>
                        
                        <div className="space-y-2">
                            {Object.entries(scoreboard).map(([model, score]) => {
                                if (model === 'Winner' || model === 'Reason') return null;
                                const isWinner = model === winnerName;
                                const errorPct = (Number(score) * 100).toFixed(1);
                                
                                return (
                                    <div 
                                        key={model} 
                                        className={`flex justify-between items-center p-3 rounded-lg border transition-all ${
                                            isWinner 
                                                ? "bg-indigo-50 border-indigo-200 shadow-sm" 
                                                : "bg-white border-transparent hover:bg-slate-50"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            {isWinner && <CheckCircle2 size={14} className="text-indigo-600" />}
                                            <span className={`text-sm ${isWinner ? 'font-bold text-indigo-900' : 'font-medium text-slate-600'}`}>
                                                {model}
                                            </span>
                                            {isWinner && (
                                                <span className="px-1.5 py-0.5 bg-indigo-200 text-indigo-800 text-[9px] font-bold uppercase rounded">
                                                    Winner
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs font-mono text-slate-500">
                                            Err: {errorPct}%
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* 3. DRIVER ANALYSIS */}
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                            <Brain size={16} className="text-purple-600" />
                            <h3 className="text-sm font-bold text-slate-900">Why this Forecast?</h3>
                        </div>
                        
                        <div className="space-y-4">
                            {Object.entries(data.drivers).map(([driver, weight]) => (
                                <div key={driver}>
                                    <div className="flex justify-between items-end mb-1">
                                        <span className="text-xs font-bold text-slate-700">{driver}</span>
                                        <span className="text-[10px] font-mono text-slate-500">{(weight * 100).toFixed(0)}% Impact</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full ${driver === 'Price' ? 'bg-rose-500' : 'bg-indigo-500'}`}
                                            style={{ width: `${Math.abs(weight * 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>

        {/* FOOTER METADATA */}
        {data && (
            <div className="p-4 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-400 font-mono flex flex-col gap-1 items-center">
                <div className="flex items-center gap-1.5">
                    <Fingerprint size={10} />
                    <span>RUN ID: {data.run_id}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Clock size={10} />
                    <span>GENERATED: {new Date(data.generated_at).toLocaleString()}</span>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};