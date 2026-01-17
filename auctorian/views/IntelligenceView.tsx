import React, { useState, useEffect } from 'react';
import { 
  Snackbar, 
  Alert 
} from '@mui/material'; // Keeping MUI for Toast/Notifications
import { 
  Play, 
  Search, 
  Activity, 
  Clock, 
  GitBranch, 
  BrainCircuit, 
  RefreshCw, 
  CheckCircle2, 
  Zap, 
  Cpu 
} from 'lucide-react';

// --- Services ---
import { api } from '../services/api';

// --- Components ---
import { ForecastAccuracyWidget } from '../components/intelligence/ForecastAccuracyWidget';
import { GlassBoxModal } from '../components/intelligence/GlassBoxModal';
import MetricCard from '../components/MetricCard';

export const IntelligenceView: React.FC = () => {
  // --- STATE (Preserved) ---
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [training, setTraining] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  
  // Glass Box State
  const [inspectSku, setInspectSku] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Notification State
  const [toast, setToast] = useState<{open: boolean, msg: string, type: 'success' | 'error' | 'info'}>({
    open: false, msg: '', type: 'info'
  });

  // --- EFFECTS & HANDLERS ---
  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const data = await api.ml.getMetrics();
      setMetrics(data);
    } catch (e) {
      console.error("Failed to load metrics", e);
    }
    setLoading(false);
  };

  const handleRunPipeline = async () => {
    setTraining(true);
    try {
      setToast({ open: true, msg: 'Initializing Intelligence Pipeline... (Cleanse -> Backtest -> Forecast)', type: 'info' });
      
      const res = await api.ml.triggerDemandModeling();
      
      if (res.status === 'success') {
        setToast({ open: true, msg: `Pipeline Complete. Generated ${res.nodes_generated} vectors.`, type: 'success' });
        setLastRun(new Date().toLocaleTimeString());
        loadMetrics(); 
      } else {
        setToast({ open: true, msg: 'Pipeline Failed or Skipped.', type: 'error' });
      }
    } catch (e) {
      setToast({ open: true, msg: 'Error connecting to ML Engine.', type: 'error' });
    }
    setTraining(false);
  };

  const openInspector = () => {
    setInspectSku('PUMA-PALERMO-GRN'); // Default SKU for demo/testing
    setDrawerOpen(true);
  };

  return (
    <div className="p-8 min-h-screen bg-slate-50 space-y-8 animate-in fade-in duration-500">
      
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <BrainCircuit className="text-indigo-600" size={32} />
            Intelligence Plane
          </h1>
          <p className="text-slate-500 mt-2 text-sm max-w-2xl">
            Orchestrate the probabilistic models driving your demand chain. Monitor accuracy, backtest strategies, and audit AI decisions.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
           <button 
            onClick={openInspector}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all text-sm font-semibold shadow-sm"
          >
            <Search size={16} />
            Open Inspector
          </button>
          <button 
            onClick={handleRunPipeline}
            disabled={training}
            className={`
                flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold shadow-md transition-all
                ${training 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-500/20'
                }
            `}
          >
            {training ? (
                <RefreshCw className="animate-spin" size={18} />
            ) : (
                <Play size={18} fill="currentColor" />
            )}
            {training ? 'Running Cycle...' : 'Run Intelligence Cycle'}
          </button>
        </div>
      </div>

      {/* 2. LIVE STATUS MONITOR */}
      {lastRun && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle2 className="text-emerald-600 mt-0.5" size={18} />
          <div>
            <p className="text-sm font-bold text-emerald-800">System Synchronized</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              Last full intelligence cycle completed at <span className="font-mono font-bold">{lastRun}</span>. Hypercube and Audit Logs are up to date.
            </p>
          </div>
        </div>
      )}

      {/* 3. KPI METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard 
          title="Model State" 
          value={metrics?.status || 'Active'} 
          change={metrics?.mode || 'Ensemble'} 
          trend="neutral"
          icon={Activity} 
        />
        <MetricCard 
          title="Forecast Horizon" 
          value="52 Weeks" 
          change="Weekly Buckets" 
          trend="up"
          icon={Clock}
        />
        <MetricCard 
          title="Active Vectors" 
          value="142" 
          change="XGBoost + Prophet" 
          trend="up"
          icon={GitBranch}
        />
      </div>

      {/* SEPARATOR */}
      <div className="w-full h-px bg-slate-200"></div>

      {/* 4. MAIN WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT: ACCURACY WIDGET (2/3 Width) */}
        <div className="lg:col-span-2 flex flex-col space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-[600px] relative">
                <ForecastAccuracyWidget />
            </div>
        </div>

        {/* RIGHT: PIPELINE HEALTH (1/3 Width) */}
        <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 h-[600px] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Cpu size={20} className="text-slate-400" />
                        Pipeline Health
                    </h3>
                    <button 
                        onClick={loadMetrics} 
                        className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-2 rounded-full transition-colors"
                        title="Refresh Status"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
                
                <div className="space-y-4 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                    
                    {/* Status Node 1 */}
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 relative group hover:border-indigo-200 transition-colors">
                        <div className="absolute left-0 top-4 bottom-4 w-1 bg-indigo-500 rounded-r-full"></div>
                        <div className="ml-3">
                            <h4 className="text-sm font-bold text-slate-800 flex items-center justify-between">
                                Vectorization
                                <CheckCircle2 size={16} className="text-emerald-500" />
                            </h4>
                            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                                Generating 100-point price elasticity curves for all SKUs to determine optimal price points.
                            </p>
                            <div className="mt-3 flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded uppercase tracking-wider">
                                    Active
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">142ms latency</span>
                            </div>
                        </div>
                    </div>

                    {/* Status Node 2 */}
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 relative group hover:border-purple-200 transition-colors">
                        <div className="absolute left-0 top-4 bottom-4 w-1 bg-purple-500 rounded-r-full"></div>
                        <div className="ml-3">
                            <h4 className="text-sm font-bold text-slate-800 flex items-center justify-between">
                                Glass Box Audit
                                <CheckCircle2 size={16} className="text-emerald-500" />
                            </h4>
                            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                                Logging feature drivers and shapley values. Every decision is traceable.
                            </p>
                            <span className="inline-block mt-3 px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded uppercase tracking-wider">
                                Logging Enabled
                            </span>
                        </div>
                    </div>

                    {/* Status Node 3 */}
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 relative group hover:border-emerald-200 transition-colors">
                        <div className="absolute left-0 top-4 bottom-4 w-1 bg-emerald-500 rounded-r-full"></div>
                        <div className="ml-3">
                            <h4 className="text-sm font-bold text-slate-800 flex items-center justify-between">
                                Self-Correction
                                <Zap size={16} className="text-amber-500" />
                            </h4>
                            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                                Backtesting against 1-month and 3-month lag snapshots to calculate WMAPE.
                            </p>
                            <span className="inline-block mt-3 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded uppercase tracking-wider">
                                Online
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer Metadata */}
                <div className="pt-4 border-t border-slate-100 text-center">
                    <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">
                        Kernel v10.3 • {lastRun ? `Synced ${lastRun}` : 'Ready'}
                    </p>
                </div>
            </div>
        </div>
      </div>

      {/* DRAWERS & MODALS */}
      <GlassBoxModal 
        open={drawerOpen} 
        onClose={() => setDrawerOpen(false)} 
        skuId={inspectSku} 
      />

      {/* TOAST NOTIFICATIONS */}
      <Snackbar 
        open={toast.open} 
        autoHideDuration={6000} 
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={toast.type} variant="filled" sx={{ width: '100%' }}>
          {toast.msg}
        </Alert>
      </Snackbar>

    </div>
  );
};

export default IntelligenceView;