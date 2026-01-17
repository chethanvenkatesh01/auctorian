import React, { useState, useEffect } from 'react';
import { TrendingUp, Activity, Zap, GitCommit, RefreshCw, AlertTriangle, PlayCircle, MessageSquare, MousePointerClick } from 'lucide-react';
import { PlanningScope } from '../../types';
import { api } from '../../services/api';

interface ForecastWorkbenchProps {
  scope: PlanningScope;
}

export const ForecastWorkbench: React.FC<ForecastWorkbenchProps> = ({ scope }) => {
  const [forecastData, setForecastData] = useState<number[]>([]);
  const [confidence, setConfidence] = useState<number>(0);
  const [narrative, setNarrative] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [trainLoading, setTrainLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // [UPDATED] Dynamic SKU Resolution
  // We prioritize the user's selection. 
  // If they are at a high level (e.g., 'All'), we effectively pause or show a prompt.
  const activeNode = scope.nodeId;
  const isSkuLevel = scope.nodeId && scope.nodeId !== 'All';

  const fetchLiveForecast = async () => {
    if (!activeNode || activeNode === 'All') return;

    setLoading(true);
    setError(null);
    setNarrative(""); 
    
    try {
        // [UPDATED] Dynamic Call using activeNode
        const data = await api.intelligence.getForecast(activeNode, 8);
        
        if (data.error) {
            setError(data.error);
            setForecastData([]);
            setNarrative("Unable to generate forecast for this entity.");
        } else {
            setForecastData(data.forecast || []);
            setConfidence(data.confidence_score || data.model_confidence || 0);
            setNarrative(data.narrative || "No analysis available.");
        }
    } catch (err) {
        console.error(err);
        setError("Failed to connect to Sovereign Node.");
    } finally {
        setLoading(false);
    }
  };

  const handleRetrain = async () => {
      setTrainLoading(true);
      try {
          await api.intelligence.retrainModel();
          await fetchLiveForecast();
      } catch (e) {
          setError("Training failed to start.");
      } finally {
          setTrainLoading(false);
      }
  };

  // [UPDATED] React to Sidebar Changes
  useEffect(() => {
      if (activeNode && activeNode !== 'All') {
          fetchLiveForecast();
      } else {
          // Clear data if we move to an invalid level to avoid confusion
          setForecastData([]);
          setConfidence(0);
          setNarrative("");
      }
  }, [activeNode]);

  // Chart Labels
  const periods = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'];

  // [NEW] Empty State for Global View
  if (!isSkuLevel) {
      return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-full flex flex-col items-center justify-center text-center opacity-80">
            <div className="bg-slate-800 p-4 rounded-full mb-4">
                <MousePointerClick className="h-8 w-8 text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Select a Product</h3>
            <p className="text-slate-400 text-sm max-w-xs">
                The Forecast Workbench requires a specific Product context. Please select a SKU from the sidebar to activate the inference engine.
            </p>
        </div>
      );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-400" />
            Forecast Workbench
          </h3>
          <p className="text-slate-400 text-sm mt-1">
            Real-time inference for <span className="text-indigo-300 font-mono">{activeNode}</span>
          </p>
        </div>
        
        <div className="flex gap-2">
            <button 
                onClick={handleRetrain}
                disabled={trainLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors border border-slate-700"
            >
                <RefreshCw className={`h-3.5 w-3.5 ${trainLoading ? 'animate-spin' : ''}`} />
                {trainLoading ? "Training..." : "Retrain Model"}
            </button>
            <button 
                onClick={fetchLiveForecast}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors"
            >
                <PlayCircle className="h-3.5 w-3.5" />
                Generate Forecast
            </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 gap-6">
          
          {/* Top Row: Metrics & Narrative */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              {/* Confidence Score Card */}
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 flex items-center justify-between">
                  <div>
                      <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Model Confidence</div>
                      <div className={`text-2xl font-bold ${confidence > 70 ? 'text-green-400' : confidence > 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {confidence}%
                      </div>
                  </div>
                  <Activity className="h-8 w-8 text-slate-600 opacity-50" />
              </div>

              {/* Sovereign Analyst Note */}
              <div className="bg-indigo-900/20 rounded-lg p-4 border border-indigo-500/30 relative">
                  <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4 text-indigo-400" />
                      <span className="text-indigo-300 text-xs font-bold uppercase tracking-wider">Analyst Note</span>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed min-h-[40px]">
                      {loading ? (
                          <span className="animate-pulse text-slate-500">Consulting Sovereign Brain...</span>
                      ) : narrative ? (
                          narrative
                      ) : (
                          <span className="text-slate-500 italic">No narrative generated.</span>
                      )}
                  </p>
              </div>
          </div>

          {/* Chart Section */}
          <div className="flex-1 bg-slate-800/30 rounded-lg p-4 border border-slate-700/50 flex flex-col relative overflow-hidden">
              {loading && (
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-10 flex items-center justify-center">
                      <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
                  </div>
              )}
              
              {error ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-red-400">
                      <AlertTriangle className="h-8 w-8 mb-2 opacity-80" />
                      <span className="text-sm font-medium">{error}</span>
                      <button onClick={fetchLiveForecast} className="mt-4 text-xs underline text-slate-400 hover:text-white">Retry Connection</button>
                  </div>
              ) : forecastData.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                      <Activity className="h-8 w-8 mb-2 opacity-20" />
                      <span className="text-sm">Ready to Forecast</span>
                  </div>
              ) : (
                  <div className="flex-1 flex items-end justify-between gap-2 px-2 pb-2">
                      {periods.map((p, i) => {
                          const foreVal = forecastData.length > i ? forecastData[i] : 0;
                          const maxVal = Math.max(...forecastData, 10) * 1.2;
                          const heightPct = Math.min((foreVal / maxVal) * 100, 100);
                          
                          return (
                              <div key={p} className="flex-1 flex flex-col items-center justify-end h-full relative group">
                                  {forecastData.length > 0 && (
                                      <div 
                                        style={{ height: `${heightPct}%` }} 
                                        className="w-full max-w-[40px] bg-indigo-500/20 border-t-2 border-indigo-500 rounded-t-sm relative transition-all duration-500 group-hover:bg-indigo-500/40"
                                      >
                                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 font-mono border border-slate-600 shadow-xl whitespace-nowrap">
                                              {foreVal} Units
                                          </div>
                                      </div>
                                  )}
                                  <span className="mt-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{p}</span>
                              </div>
                          );
                      })}
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default ForecastWorkbench;
