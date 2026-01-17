import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
// Keeping specific MUI components if needed for tooltips, otherwise standard HTML title works. 
// Using MUI Tooltip for better UX as per original.
import { Tooltip, LinearProgress } from '@mui/material';
import { 
  Info, 
  ChevronDown, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Target 
} from 'lucide-react';

interface AccuracyScore {
  lag: string;
  wmape: number;
  accuracy: number;
  bias: number;
  health: 'GOOD' | 'RISK' | 'POOR';
}

interface NodeAccuracy {
  id: string;
  name: string;
  metrics: Record<string, AccuracyScore>;
}

export const ForecastAccuracyWidget: React.FC = () => {
  // --- STATE (Preserved) ---
  const [selectedNode, setSelectedNode] = useState<string>('GLOBAL');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // Hardcoded nodes list from original
  const [nodes] = useState<{id: string, name: string}[]>([
    { id: 'GLOBAL', name: 'Global Enterprise' },
    { id: 'DIV-FOOTWEAR', name: 'Div: Footwear' },
    { id: 'DIV-APPAREL', name: 'Div: Apparel' }
  ]);

  // --- DATA FETCHING ---
  useEffect(() => {
    fetchAccuracy(selectedNode);
  }, [selectedNode]);

  const fetchAccuracy = async (nodeId: string) => {
    setLoading(true);
    try {
      const result = await api.ml.getForecastAccuracy(nodeId);
      setData(result);
    } catch (e) {
      console.error("Failed to fetch accuracy", e);
    }
    setLoading(false);
  };

  // --- VISUAL HELPERS ---
  const getHealthBadge = (score: number) => {
    // WMAPE: Lower is better
    if (score <= 0.20) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100 shadow-sm">
                <CheckCircle2 size={12} strokeWidth={3} /> 
                {(score * 100).toFixed(1)}% Error
            </span>
        );
    }
    if (score <= 0.40) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-100 shadow-sm">
                <AlertTriangle size={12} strokeWidth={3} /> 
                {(score * 100).toFixed(1)}% Error
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-100 shadow-sm">
            <AlertTriangle size={12} strokeWidth={3} /> 
            {(score * 100).toFixed(1)}% Error
        </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      
      {/* 1. HEADER */}
      <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white relative z-10">
        <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Target className="text-indigo-600" size={20} />
                Forecast Reliability Matrix
            </h3>
            <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-slate-500">WMAPE Accuracy across Time Horizons</p>
                <Tooltip title="We compare past forecasts (1mo, 3mo lags) against actuals to grade model performance. Green = Trust, Red = Intervene." arrow placement="right">
                    <Info size={14} className="text-slate-400 cursor-help hover:text-indigo-500 transition-colors" />
                </Tooltip>
            </div>
        </div>

        <div className="relative group">
            <select 
                value={selectedNode}
                onChange={(e) => setSelectedNode(e.target.value)}
                className="appearance-none w-full sm:w-64 bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold py-2.5 pl-4 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer hover:bg-slate-100 transition-all shadow-sm"
            >
                {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-3.5 text-slate-400 pointer-events-none group-hover:text-indigo-500 transition-colors" />
        </div>
      </div>

      {/* 2. LOADING STATE */}
      {loading && (
        <div className="w-full">
            <LinearProgress sx={{ backgroundColor: '#f1f5f9', '& .MuiLinearProgress-bar': { backgroundColor: '#6366f1' } }} />
        </div>
      )}
      
      {/* 3. DATA GRID */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-slate-50/30">
        {!loading && data && (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="py-3 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    Hierarchy Node
                </th>
                <th className="py-3 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-center border-b border-slate-200">
                    Last Month <span className="block text-[10px] text-slate-400 font-medium normal-case mt-0.5">(Lag 4W)</span>
                </th>
                <th className="py-3 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-center border-b border-slate-200">
                    Last Quarter <span className="block text-[10px] text-slate-400 font-medium normal-case mt-0.5">(Lag 12W)</span>
                </th>
                <th className="py-3 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-center border-b border-slate-200">
                    Bias Trend
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              
              {/* Parent Row (Highlighted) */}
              <tr className="bg-indigo-50/30 hover:bg-indigo-50/60 transition-colors">
                <td className="py-5 px-6">
                    <div className="flex items-center gap-3">
                        <div className="font-bold text-slate-900 text-sm">
                            {selectedNode === 'GLOBAL' ? 'Global Enterprise' : selectedNode}
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-indigo-100 text-indigo-700 tracking-wide border border-indigo-200">
                            Root
                        </span>
                    </div>
                </td>
                <td className="py-5 px-6 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                        <span className="text-xl font-mono font-bold text-slate-800 tracking-tight">
                            {data.scores?.['1_MONTH']?.accuracy ?? '-'}%
                        </span>
                        {getHealthBadge(data.scores?.['1_MONTH']?.wmape)}
                    </div>
                </td>
                <td className="py-5 px-6 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                        <span className="text-xl font-mono font-bold text-slate-800 tracking-tight">
                            {data.scores?.['3_MONTH']?.accuracy ?? '-'}%
                        </span>
                        {getHealthBadge(data.scores?.['3_MONTH']?.wmape)}
                    </div>
                </td>
                <td className="py-5 px-6 text-center">
                    {data.scores?.['1_MONTH'] && (
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                            data.scores['1_MONTH'].bias > 0 
                                ? 'bg-amber-50 text-amber-700 border-amber-100' 
                                : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                        }`}>
                            <TrendingUp size={14} className={data.scores['1_MONTH'].bias > 0 ? '' : 'rotate-180'} />
                            {data.scores['1_MONTH'].bias > 0 ? 'Over' : 'Under'}
                        </div>
                    )}
                </td>
              </tr>

              {/* Children Rows */}
              {data.children_scores?.map((child: NodeAccuracy) => (
                <tr key={child.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="py-4 px-6 border-l-[3px] border-transparent hover:border-indigo-500 transition-all">
                    <div className="pl-6 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-indigo-400 transition-colors"></div>
                        <span className="text-slate-600 font-medium text-sm group-hover:text-slate-900 transition-colors">
                            {child.name}
                        </span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="font-mono text-slate-600 font-semibold group-hover:text-slate-900">
                        {child.metrics?.['1_MONTH']?.accuracy ?? '-'}%
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="font-mono text-slate-600 font-semibold group-hover:text-slate-900">
                        {child.metrics?.['3_MONTH']?.accuracy ?? '-'}%
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                     {child.metrics?.['1_MONTH']?.bias ? (
                        <span className={`text-xs font-mono font-medium ${child.metrics['1_MONTH'].bias > 0 ? 'text-amber-600' : 'text-indigo-600'}`}>
                            {child.metrics['1_MONTH'].bias > 0 ? '+' : ''}{(child.metrics['1_MONTH'].bias * 100).toFixed(1)}%
                        </span>
                     ) : (
                        <span className="text-slate-300">-</span>
                     )}
                  </td>
                </tr>
              ))}
              
              {(!data.children_scores || data.children_scores.length === 0) && (
                <tr>
                  <td colSpan={4} className="py-12 text-center">
                    <p className="text-slate-400 text-sm font-medium">No sub-nodes available for breakdown.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};