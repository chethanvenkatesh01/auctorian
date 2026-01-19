import React, { useState, useRef } from 'react';
import { Upload, FileText, ArrowRight, AlertCircle, X, Lock, Zap, Package, TrendingUp, Cloud, Sparkles } from 'lucide-react';
import { ConstitutionalFamily, SchemaField, AnchorDefinition } from '../types';

interface IngestionMapperProps {
  title: string;
  description: string;
  onComplete: (result: any) => void;
}

// The Constitution: Available Anchors by Family
const ANCHOR_CATALOG: AnchorDefinition[] = [
  // INTRINSIC (What it IS)
  { anchor: 'ANCHOR_PRODUCT_ID', label: 'Product ID', family: ConstitutionalFamily.INTRINSIC, mandatory: true, description: 'Unique identifier', unlocks: 'System Identity' },
  { anchor: 'ANCHOR_PRODUCT_NAME', label: 'Product Name', family: ConstitutionalFamily.INTRINSIC, mandatory: true, description: 'Display name' },
  { anchor: 'ANCHOR_CATEGORY', label: 'Category', family: ConstitutionalFamily.INTRINSIC, mandatory: false, description: 'Hierarchy Level 1' },

  // STATE (What it HAS)
  { anchor: 'ANCHOR_RETAIL_PRICE', label: 'Retail Price', family: ConstitutionalFamily.STATE, mandatory: true, description: 'Revenue Physics', unlocks: 'Price Optimization' },
  { anchor: 'ANCHOR_STOCK_ON_HAND', label: 'Stock on Hand', family: ConstitutionalFamily.STATE, mandatory: false, description: 'Inventory snapshot', unlocks: 'Censored Demand Logic' },
  { anchor: 'ANCHOR_LAUNCH_DATE', label: 'Launch Date', family: ConstitutionalFamily.STATE, mandatory: false, description: 'Product birth', unlocks: 'NPI Forecasting' },

  // PERFORMANCE (What it DID)
  { anchor: 'ANCHOR_SALES_QTY', label: 'Sales Quantity', family: ConstitutionalFamily.PERFORMANCE, mandatory: false, description: 'Transaction volume' },
  { anchor: 'ANCHOR_SALES_VAL', label: 'Sales Value', family: ConstitutionalFamily.PERFORMANCE, mandatory: false, description: 'Revenue generated' },

  // ENVIRONMENTAL (External Forces)
  { anchor: 'ANCHOR_COMP_PRICE', label: 'Competitor Price', family: ConstitutionalFamily.ENVIRONMENTAL, mandatory: false, description: 'Market signal', unlocks: 'Competitive Pricing' },
];

const FAMILY_COLORS = {
  [ConstitutionalFamily.INTRINSIC]: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  [ConstitutionalFamily.STATE]: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  [ConstitutionalFamily.PERFORMANCE]: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  [ConstitutionalFamily.ENVIRONMENTAL]: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
};

const FAMILY_ICONS = {
  [ConstitutionalFamily.INTRINSIC]: Package,
  [ConstitutionalFamily.STATE]: Zap,
  [ConstitutionalFamily.PERFORMANCE]: TrendingUp,
  [ConstitutionalFamily.ENVIRONMENTAL]: Cloud,
};

export const IngestionMapper: React.FC<IngestionMapperProps> = ({ title, description, onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Map<string, SchemaField>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Smart Auto-Detection
  const autoDetect = (header: string): { anchor?: string; family: ConstitutionalFamily } | null => {
    const h = header.toLowerCase();

    // ID Detection
    if (h.includes('sku') || h.includes('product_id') || h.includes('id'))
      return { anchor: 'ANCHOR_PRODUCT_ID', family: ConstitutionalFamily.INTRINSIC };
    if (h.includes('name') || h.includes('title') || h.includes('description'))
      return { anchor: 'ANCHOR_PRODUCT_NAME', family: ConstitutionalFamily.INTRINSIC };
    if (h.includes('category') || h.includes('dept') || h.includes('division'))
      return { anchor: 'ANCHOR_CATEGORY', family: ConstitutionalFamily.INTRINSIC };

    // Price Detection
    if (h.includes('price') || h.includes('msrp') || h.includes('retail'))
      return { anchor: 'ANCHOR_RETAIL_PRICE', family: ConstitutionalFamily.STATE };
    if (h.includes('stock') || h.includes('inventory') || h.includes('qty_on_hand'))
      return { anchor: 'ANCHOR_STOCK_ON_HAND', family: ConstitutionalFamily.STATE };
    if (h.includes('launch') || h.includes('intro_date') || h.includes('release'))
      return { anchor: 'ANCHOR_LAUNCH_DATE', family: ConstitutionalFamily.STATE };

    // Performance
    if (h.includes('sales') || h.includes('sold') || h.includes('units'))
      return { anchor: 'ANCHOR_SALES_QTY', family: ConstitutionalFamily.PERFORMANCE };
    if (h.includes('revenue') || h.includes('sales_amt'))
      return { anchor: 'ANCHOR_SALES_VAL', family: ConstitutionalFamily.PERFORMANCE };

    // Environmental
    if (h.includes('comp') || h.includes('competitor'))
      return { anchor: 'ANCHOR_COMP_PRICE', family: ConstitutionalFamily.ENVIRONMENTAL };

    // Default: Unmapped Attribute
    return { family: ConstitutionalFamily.INTRINSIC };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      parseHeaders(selectedFile);
    }
  };

  const parseHeaders = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const firstLine = text.split('\n')[0];
      let delimiter = ',';
      if (firstLine.includes('|')) delimiter = '|';
      else if (firstLine.includes(';')) delimiter = ';';
      else if (firstLine.includes('\t')) delimiter = '\t';

      const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
      setCsvHeaders(headers);

      // Auto-Detect
      const initialMappings = new Map<string, SchemaField>();
      headers.forEach((header, idx) => {
        const detection = autoDetect(header);
        if (detection) {
          initialMappings.set(header, {
            name: header,
            generic_anchor: detection.anchor,
            family_type: detection.family,
            is_attribute: true,
            is_hierarchy: header.toLowerCase().includes('category') || header.toLowerCase().includes('dept'),
            hierarchy_level: header.toLowerCase().includes('category') ? 1 : undefined
          });
        }
      });
      setMappings(initialMappings);
    };
    reader.readAsText(file.slice(0, 5000));
  };

  const updateMapping = (csvHeader: string, anchorKey: string) => {
    const anchor = ANCHOR_CATALOG.find(a => a.anchor === anchorKey);
    if (!anchor && anchorKey !== 'SKIP') return;

    const updated = new Map(mappings);
    if (anchorKey === 'SKIP') {
      updated.delete(csvHeader);
    } else {
      updated.set(csvHeader, {
        name: csvHeader,
        generic_anchor: anchor!.anchor,
        family_type: anchor!.family,
        is_attribute: true
      });
    }
    setMappings(updated);
  };

  const validateSchema = (): { valid: boolean; missing: string[] } => {
    const mandatory = ANCHOR_CATALOG.filter(a => a.mandatory).map(a => a.anchor);
    const mapped = Array.from(mappings.values()).map(m => m.generic_anchor).filter(Boolean);
    const missing = mandatory.filter(m => !mapped.includes(m));
    return { valid: missing.length === 0, missing };
  };

  const getUnlockedCapabilities = (): string[] => {
    const mapped = Array.from(mappings.values()).map(m => m.generic_anchor).filter(Boolean);
    return ANCHOR_CATALOG.filter(a => a.unlocks && mapped.includes(a.anchor)).map(a => a.unlocks!);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setIsSubmitting(true);
    setError(null);

    const validation = validateSchema();
    if (!validation.valid) {
      setError(`❌ CONSTITUTIONAL VIOLATION: Missing ${validation.missing.map(m => m.replace('ANCHOR_', '')).join(', ')}`);
      setIsSubmitting(false);
      return;
    }

    try {
      const fields = Array.from(mappings.values());
      const { api } = await import('../services/api');
      await api.ontology.registerSchema('PRODUCT', fields);
      onComplete({ status: 'success', fields });
    } catch (err: any) {
      setError(err.message || "Schema Registration Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setCsvHeaders([]);
    setMappings(new Map());
    setError(null);
  };

  const validation = validateSchema();
  const unlockedCapabilities = getUnlockedCapabilities();
  const completeness = Math.round((Array.from(mappings.values()).filter(m => m.generic_anchor).length / ANCHOR_CATALOG.filter(a => a.mandatory).length) * 100);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h4 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="text-indigo-500" /> {title}
        </h4>
        <p className="text-sm text-slate-500">{description}</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2 border border-red-200">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {!file && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors p-8"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Upload size={40} />
          </div>
          <p className="font-bold text-slate-700 text-lg">Upload Product Master</p>
          <p className="text-xs text-slate-400 mt-1">CSV only • Constitutional Mapping Required</p>
          <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileChange} />
        </div>
      )}

      {file && (
        <div className="flex-1 flex flex-col">
          <div className="flex justify-between items-center p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg mb-6 border border-indigo-100">
            <div className="flex items-center gap-3">
              <FileText className="text-indigo-600" size={20} />
              <div>
                <div className="text-sm font-bold text-slate-800">{file.name}</div>
                <div className="text-xs text-slate-500">{csvHeaders.length} columns detected</div>
              </div>
            </div>
            <button onClick={reset} className="text-slate-400 hover:text-red-500"><X size={18} /></button>
          </div>

          {/* Progress Bar */}
          <div className="mb-6 p-4 bg-white rounded-lg border border-slate-200">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-slate-600">Constitution Completeness</span>
              <span className="text-xs font-bold text-indigo-600">{completeness}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500"
                style={{ width: `${completeness}%` }}
              />
            </div>

            {/* Unlocked Badges */}
            {unlockedCapabilities.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {unlockedCapabilities.map(cap => (
                  <span key={cap} className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200 flex items-center gap-1">
                    <Sparkles size={12} /> UNLOCKED: {cap}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Mapping Grid by Family */}
          <div className="flex-1 overflow-auto pr-2 space-y-6">
            {Object.values(ConstitutionalFamily).map(family => {
              const anchors = ANCHOR_CATALOG.filter(a => a.family === family);
              const FamilyIcon = FAMILY_ICONS[family];
              const colors = FAMILY_COLORS[family];

              return (
                <div key={family} className={`p-4 rounded-lg border ${colors.border} ${colors.bg}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <FamilyIcon size={18} className={colors.text} />
                    <h5 className={`text-sm font-bold ${colors.text} uppercase tracking-wide`}>{family}</h5>
                  </div>

                  <div className="space-y-3">
                    {csvHeaders.map(header => {
                      const mapping = mappings.get(header);
                      if (mapping && mapping.family_type === family) {
                        return (
                          <div key={header} className="grid grid-cols-2 gap-3 items-center">
                            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                              {header}
                              {mapping.generic_anchor && anchors.find(a => a.anchor === mapping.generic_anchor)?.mandatory && (
                                <span className="text-xs text-red-500">*</span>
                              )}
                            </label>
                            <select
                              className={`text-sm border rounded-lg p-2 bg-white ${mapping.generic_anchor && anchors.find(a => a.anchor === mapping.generic_anchor)?.mandatory && !mapping.generic_anchor
                                  ? 'border-red-300 bg-red-50'
                                  : 'border-slate-300'
                                }`}
                              value={mapping.generic_anchor || ''}
                              onChange={(e) => updateMapping(header, e.target.value)}
                            >
                              <option value="">-- Select Anchor --</option>
                              {anchors.map(a => (
                                <option key={a.anchor} value={a.anchor}>
                                  {a.label} {a.mandatory ? '*' : ''}
                                </option>
                              ))}
                              <option value="SKIP">(Skip Column)</option>
                            </select>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Submit Button */}
          <div className="pt-6 mt-4 border-t border-slate-200">
            <button
              onClick={handleSubmit}
              disabled={!validation.valid || isSubmitting}
              className={`w-full font-bold py-4 rounded-xl transition-all flex justify-center items-center gap-2 ${validation.valid
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
            >
              {isSubmitting ? (
                <span>Locking Constitution...</span>
              ) : validation.valid ? (
                <>
                  <Lock size={18} />
                  <span>Lock Schema & Proceed</span>
                  <ArrowRight size={18} />
                </>
              ) : (
                <>
                  <AlertCircle size={18} />
                  <span>Constitution Invalid ({validation.missing.length} missing)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
