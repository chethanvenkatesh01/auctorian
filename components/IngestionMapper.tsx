import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, ArrowRight, AlertCircle, X, Lock, Zap, Package, TrendingUp, Cloud, Sparkles, Plus, Calculator } from 'lucide-react';
import { ConstitutionalFamily, SchemaField, AnchorDefinition } from '../types';
import { FormulaBuilderModal } from './FormulaBuilderModal';

interface IngestionMapperProps {
  title: string;
  description: string;
  entityType: string; // Dynamic: 'PRODUCT', 'TRANSACTION', 'INVENTORY', or custom
  initialSchema?: SchemaField[]; // For edit mode - pre-fill from existing schema
  onComplete: (result: any) => void;
}

// Core Anchor Catalogs by Entity Type
const PRODUCT_ANCHORS: AnchorDefinition[] = [
  { anchor: 'ANCHOR_PRODUCT_ID', label: 'Product ID', family: ConstitutionalFamily.INTRINSIC, mandatory: true, description: 'Unique identifier', unlocks: 'System Identity' },
  { anchor: 'ANCHOR_PRODUCT_NAME', label: 'Product Name', family: ConstitutionalFamily.INTRINSIC, mandatory: true, description: 'Display name' },
  { anchor: 'ANCHOR_CATEGORY', label: 'Category', family: ConstitutionalFamily.INTRINSIC, mandatory: false, description: 'Hierarchy Level 1' },
  { anchor: 'ANCHOR_RETAIL_PRICE', label: 'Retail Price', family: ConstitutionalFamily.STATE, mandatory: true, description: 'Revenue Physics', unlocks: 'Price Optimization' },
  { anchor: 'ANCHOR_STOCK_ON_HAND', label: 'Stock on Hand', family: ConstitutionalFamily.STATE, mandatory: false, description: 'Inventory snapshot', unlocks: 'Censored Demand Logic' },
  { anchor: 'ANCHOR_LAUNCH_DATE', label: 'Launch Date', family: ConstitutionalFamily.STATE, mandatory: false, description: 'Product birth', unlocks: 'NPI Forecasting' },
];

const TRANSACTION_ANCHORS: AnchorDefinition[] = [
  { anchor: 'ANCHOR_TX_ID', label: 'Transaction ID', family: ConstitutionalFamily.INTRINSIC, mandatory: true, description: 'Unique transaction ID' },
  { anchor: 'ANCHOR_PRODUCT_ID', label: 'Product ID', family: ConstitutionalFamily.INTRINSIC, mandatory: true, description: 'Product reference' },
  { anchor: 'ANCHOR_DATE', label: 'Transaction Date', family: ConstitutionalFamily.STATE, mandatory: true, description: 'Timestamp' },
  { anchor: 'ANCHOR_SALES_QTY', label: 'Sales Quantity', family: ConstitutionalFamily.PERFORMANCE, mandatory: true, description: 'Units sold', unlocks: 'Demand Forecasting' },
  { anchor: 'ANCHOR_SALES_VAL', label: 'Sales Value', family: ConstitutionalFamily.PERFORMANCE, mandatory: false, description: 'Revenue generated' },
];

const INVENTORY_ANCHORS: AnchorDefinition[] = [
  { anchor: 'ANCHOR_PRODUCT_ID', label: 'Product ID', family: ConstitutionalFamily.INTRINSIC, mandatory: true, description: 'Product reference' },
  { anchor: 'ANCHOR_DATE', label: 'Snapshot Date', family: ConstitutionalFamily.STATE, mandatory: true, description: 'Inventory date' },
  { anchor: 'ANCHOR_STOCK_ON_HAND', label: 'Stock on Hand', family: ConstitutionalFamily.STATE, mandatory: true, description: 'Current inventory', unlocks: 'Stockout Prediction' },
  { anchor: 'ANCHOR_ON_ORDER', label: 'On Order', family: ConstitutionalFamily.STATE, mandatory: false, description: 'Units in transit' },
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

export const IngestionMapper: React.FC<IngestionMapperProps> = ({ title, description, entityType, initialSchema, onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<Map<string, SchemaField>>(new Map());
  const [derivedFields, setDerivedFields] = useState<Map<string, SchemaField>>(new Map()); // Formula-based fields
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFormulaModalOpen, setIsFormulaModalOpen] = useState(false);
  const [currentFormulaField, setCurrentFormulaField] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // EDIT MODE: Hydrate from initialSchema (CTO's critical feedback)
  useEffect(() => {
    if (initialSchema && initialSchema.length > 0) {
      // Reconstruct headers from schema (source column names)
      const headers = initialSchema
        .filter(f => !f.formula) // Exclude derived fields
        .map(f => f.source_column_name || f.name);

      setCsvHeaders(headers);

      // Rebuild mappings
      const initialMappings = new Map<string, SchemaField>();
      const initialDerived = new Map<string, SchemaField>();

      initialSchema.forEach(field => {
        if (field.formula) {
          initialDerived.set(field.name, field);
        } else {
          const columnName = field.source_column_name || field.name;
          initialMappings.set(columnName, field);
        }
      });

      setMappings(initialMappings);
      setDerivedFields(initialDerived);

      console.log(`✏️ Edit Mode: Hydrated ${initialMappings.size} fields + ${initialDerived.size} formulas`);
    }
  }, [initialSchema]);

  // Determine anchor catalog based on entity type
  const getAnchorCatalog = (): AnchorDefinition[] => {
    switch (entityType.toUpperCase()) {
      case 'PRODUCT': return PRODUCT_ANCHORS;
      case 'TRANSACTION': return TRANSACTION_ANCHORS;
      case 'INVENTORY': return INVENTORY_ANCHORS;
      default: return []; // Custom entity - no predefined anchors
    }
  };

  const anchorCatalog = getAnchorCatalog();
  const isCustomEntity = anchorCatalog.length === 0;

  // Generate custom anchor from column name
  const generateCustomAnchor = (columnName: string): string => {
    return `ANCHOR_${columnName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  };

  const loadUserPreferences = (): Record<string, string> => {
    try {
      const prefs = localStorage.getItem(`auctorian_mapping_${entityType.toLowerCase()}`);
      return prefs ? JSON.parse(prefs) : {};
    } catch {
      return {};
    }
  };

  const saveUserPreferences = (header: string, anchor: string) => {
    try {
      const prefs = loadUserPreferences();
      prefs[header.toLowerCase()] = anchor;
      localStorage.setItem(`auctorian_mapping_${entityType.toLowerCase()}`, JSON.stringify(prefs));
    } catch (e) {
      console.warn('Failed to save preferences', e);
    }
  };

  const autoDetect = (header: string): { anchor?: string; family: ConstitutionalFamily } | null => {
    const h = header.toLowerCase();

    // Check user preferences first
    const userPrefs = loadUserPreferences();
    if (userPrefs[h]) {
      const anchor = anchorCatalog.find(a => a.anchor === userPrefs[h]);
      if (anchor) return { anchor: anchor.anchor, family: anchor.family };
    }

    // For custom entities, generate anchor and default to INTRINSIC
    if (isCustomEntity) {
      return { anchor: generateCustomAnchor(header), family: ConstitutionalFamily.INTRINSIC };
    }

    // Core entity auto-detection
    if (h.includes('sku') || h.includes('product_id') || h.includes('id')) {
      const match = anchorCatalog.find(a => a.anchor.includes('PRODUCT_ID') || a.anchor.includes('_ID'));
      return match ? { anchor: match.anchor, family: match.family } : null;
    }
    if (h.includes('name') || h.includes('title')) {
      const match = anchorCatalog.find(a => a.anchor.includes('NAME'));
      return match ? { anchor: match.anchor, family: match.family } : null;
    }
    if (h.includes('price') || h.includes('msrp') || h.includes('retail')) {
      const match = anchorCatalog.find(a => a.anchor.includes('PRICE'));
      return match ? { anchor: match.anchor, family: match.family } : null;
    }
    if (h.includes('qty') || h.includes('quantity') || h.includes('units')) {
      const match = anchorCatalog.find(a => a.anchor.includes('QTY') || a.anchor.includes('STOCK'));
      return match ? { anchor: match.anchor, family: match.family } : null;
    }
    if (h.includes('date') || h.includes('time')) {
      const match = anchorCatalog.find(a => a.anchor.includes('DATE'));
      return match ? { anchor: match.anchor, family: match.family } : null;
    }

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
      const lines = text.split('\n').filter(l => l.trim());
      const firstLine = lines[0];

      let delimiter = ',';
      if (firstLine.includes('|')) delimiter = '|';
      else if (firstLine.includes(';')) delimiter = ';';
      else if (firstLine.includes('\t')) delimiter = '\t';

      const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
      setCsvHeaders(headers);

      const dataRows = lines.slice(1, 4).map(line =>
        line.split(delimiter).map(cell => cell.trim().replace(/^"|"$/g, ''))
      );
      setCsvData(dataRows);

      // SMART MERGE: Preserve existing mappings if column name matches
      const mergedMappings = new Map<string, SchemaField>();

      headers.forEach((header) => {
        // If we already have a mapping for this header (from initialSchema or previous work), keep it.
        if (mappings.has(header)) {
          mergedMappings.set(header, mappings.get(header)!);
        } else {
          // New column -> Auto-detect
          const detection = autoDetect(header);
          if (detection) {
            mergedMappings.set(header, {
              name: header,
              generic_anchor: detection.anchor,
              family_type: detection.family,
              is_attribute: true,
              is_hierarchy: header.toLowerCase().includes('category') || header.toLowerCase().includes('dept'),
              hierarchy_level: header.toLowerCase().includes('category') ? 1 : undefined
            });
          }
        }
      });
      setMappings(mergedMappings);
    };
    reader.readAsText(file.slice(0, 10000));
  };

  const updateMapping = (csvHeader: string, anchorKey: string, familyType?: ConstitutionalFamily) => {
    const updated = new Map(mappings);

    if (anchorKey === 'SKIP') {
      updated.delete(csvHeader);
    } else {
      const anchor = anchorCatalog.find(a => a.anchor === anchorKey);
      // For custom entities or if anchor not found, use the provided values
      updated.set(csvHeader, {
        name: csvHeader,
        generic_anchor: anchorKey,
        family_type: familyType || anchor?.family || ConstitutionalFamily.INTRINSIC,
        is_attribute: true
      });

      if (anchor || isCustomEntity) {
        saveUserPreferences(csvHeader, anchorKey);
      }
    }
    setMappings(updated);
  };

  const validateSchema = (): { valid: boolean; missing: string[] } => {
    const mandatory = anchorCatalog.filter(a => a.mandatory).map(a => a.anchor);
    const mapped = Array.from(mappings.values()).map(m => m.generic_anchor).filter(Boolean);
    const missing = mandatory.filter(m => !mapped.includes(m));

    // Custom entities don't have mandatory fields
    if (isCustomEntity && mappings.size > 0) {
      return { valid: true, missing: [] };
    }

    return { valid: missing.length === 0, missing };
  };

  const getUnlockedCapabilities = (): string[] => {
    const mapped = Array.from(mappings.values()).map(m => m.generic_anchor).filter(Boolean);
    return anchorCatalog.filter(a => a.unlocks && mapped.includes(a.anchor)).map(a => a.unlocks!);
  };

  const handleOpenFormulaBuilder = () => {
    const fieldName = `CALCULATED_FIELD_${derivedFields.size + 1}`;
    setCurrentFormulaField(fieldName);
    setIsFormulaModalOpen(true);
  };

  const handleFormulaSave = (formula: string) => {
    const derivedField: SchemaField = {
      name: currentFormulaField,
      generic_anchor: `ANCHOR_${currentFormulaField}`,
      family_type: ConstitutionalFamily.PERFORMANCE, // Default to performance for calculations
      is_attribute: true,
      formula: formula
    };

    const updated = new Map(derivedFields);
    updated.set(currentFormulaField, derivedField);
    setDerivedFields(updated);
  };

  const handleRemoveDerivedField = (fieldName: string) => {
    const updated = new Map(derivedFields);
    updated.delete(fieldName);
    setDerivedFields(updated);
  };

  const handleSubmit = async () => {
    if (!hasActiveContext) return;
    setIsSubmitting(true);
    setError(null);

    const validation = validateSchema();
    if (!validation.valid) {
      setError(`❌ CONSTITUTIONAL VIOLATION: Missing ${validation.missing.map(m => m.replace('ANCHOR_', '')).join(', ')}`);
      setIsSubmitting(false);
      return;
    }

    try {
      // Combine base mappings and derived fields
      const allFields = [...Array.from(mappings.values()), ...Array.from(derivedFields.values())];
      onComplete({ entityType, fields: allFields });
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
  const completeness = isCustomEntity
    ? (mappings.size > 0 ? 100 : 0)
    : Math.round((Array.from(mappings.values()).filter(m => m.generic_anchor).length / anchorCatalog.filter(a => a.mandatory).length) * 100);

  // CONTEXT-AWARE STATE: Do we have a file OR an existing schema?
  const hasActiveContext = !!file || (csvHeaders.length > 0 && !!initialSchema);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h4 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="text-indigo-500" /> {title}
        </h4>
        <p className="text-sm text-slate-500">{description}</p>
        {isCustomEntity && (
          <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            <strong>Custom Entity Mode:</strong> No predefined anchors. Anchors will be auto-generated from your column names.
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2 border border-red-200">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* 1. UPLOAD STATE: Only show if no context exists */}
      {!hasActiveContext && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors p-8"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Upload size={40} />
          </div>
          <p className="font-bold text-slate-700 text-lg">Upload {entityType} Data</p>
          <p className="text-xs text-slate-400 mt-1">CSV only • Constitutional Mapping Required</p>
          <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileChange} />
        </div>
      )}

      {/* 2. EDITOR STATE: Show if context exists (File OR Schema) */}
      {hasActiveContext && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* CONTROL BAR */}
          <div className="flex justify-between items-center p-4 bg-slate-50 border border-slate-200 rounded-lg mb-4 shrink-0">
            <div className="flex items-center gap-3">
              <FileText className="text-indigo-600" size={20} />
              <div>
                <div className="text-sm font-bold text-slate-800">
                  {file ? file.name : `Existing Schema: ${entityType}`}
                </div>
                <div className="text-xs text-slate-500">
                  {csvHeaders.length} columns • {file ? 'New Upload' : 'Database Version'}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileChange} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md border border-indigo-200 transition-colors"
              >
                {file ? 'Change File' : 'Replace Source File'}
              </button>
              <button onClick={reset} className="text-slate-400 hover:text-red-500 p-1">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* PROMINENT FORMULA BUTTON */}
          <button
            onClick={handleOpenFormulaBuilder}
            className="mb-6 w-full py-3 bg-gradient-to-r from-violet-600/10 to-fuchsia-600/10 hover:from-violet-600/20 hover:to-fuchsia-600/20 border border-violet-200 text-violet-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-all group shrink-0"
          >
            <Sparkles size={16} className="group-hover:animate-pulse" />
            <span>✨ Create Synthetic Feature (Formula)</span>
            <Plus size={16} className="opacity-50" />
          </button>

          {/* STATUS CARD */}
          <div className="mb-6 p-4 bg-white rounded-lg border border-slate-200 shrink-0">
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

            {unlockedCapabilities.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {unlockedCapabilities.map(cap => (
                  <span key={cap} className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200 flex items-center gap-1">
                    <Sparkles size={12} /> UNLOCKED: {cap}
                  </span>
                ))}
              </div>
            )}

            {isCustomEntity && mappings.size > 0 && (
              <div className="mt-3">
                <span className="px-2 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-200">
                  Auxiliary Context Added ({mappings.size} fields)
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-6">
            {Object.values(ConstitutionalFamily).map(family => {
              const familyMappings = Array.from(mappings.entries()).filter(([_, m]) => m.family_type === family);
              if (familyMappings.length === 0) return null;

              const FamilyIcon = FAMILY_ICONS[family];
              const colors = FAMILY_COLORS[family];

              return (
                <div key={family} className={`p-4 rounded-lg border ${colors.border} ${colors.bg}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <FamilyIcon size={18} className={colors.text} />
                    <h5 className={`text-sm font-bold ${colors.text} uppercase tracking-wide`}>{family}</h5>
                  </div>

                  <div className="space-y-3">
                    {familyMappings.map(([header, mapping], idx) => {
                      const headerIdx = csvHeaders.indexOf(header);
                      const sampleData = csvData.map(row => row[headerIdx]).filter(Boolean);

                      return (
                        <div key={header} className="space-y-2">
                          <div className="grid grid-cols-2 gap-3 items-center">
                            <label className="text-sm font-medium text-slate-700">{header}</label>
                            {isCustomEntity ? (
                              <div className="text-sm bg-white border border-slate-300 rounded-lg p-2 font-mono text-slate-600">
                                {mapping.generic_anchor}
                              </div>
                            ) : (
                              <select
                                className="text-sm border rounded-lg p-2 bg-white border-slate-300"
                                value={mapping.generic_anchor || ''}
                                onChange={(e) => updateMapping(header, e.target.value)}
                              >
                                <option value="">-- Select Anchor --</option>
                                {anchorCatalog.filter(a => a.family === family).map(a => (
                                  <option key={a.anchor} value={a.anchor}>
                                    {a.label} {a.mandatory ? '*' : ''}
                                  </option>
                                ))}
                                <option value="SKIP">(Skip Column)</option>
                              </select>
                            )}
                          </div>

                          {sampleData.length > 0 && (
                            <div className="ml-0 pl-4 border-l-2 border-slate-200">
                              <div className="text-xs text-slate-500 font-medium mb-1">Sample Data:</div>
                              <div className="flex flex-wrap gap-1">
                                {sampleData.slice(0, 3).map((val, idx) => (
                                  <span key={idx} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded font-mono">
                                    {val.length > 20 ? val.substring(0, 20) + '...' : val}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-6 mt-4 border-t border-slate-200 shrink-0">
            <button
              onClick={handleSubmit}
              disabled={!validation.valid || isSubmitting}
              className={`w-full font-bold py-4 rounded-xl transition-all flex justify-center items-center gap-2 ${validation.valid
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
            >
              {isSubmitting ? (
                <span>Registering Schema...</span>
              ) : validation.valid ? (
                <>
                  <Lock size={18} />
                  <span>Register {entityType} Schema</span>
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

      {/* Formula Builder Modal */}
      {isFormulaModalOpen && (
        <FormulaBuilderModal
          isOpen={isFormulaModalOpen}
          onClose={() => setIsFormulaModalOpen(false)}
          onSave={handleFormulaSave}
          availableFields={Array.from(mappings.keys())}
        />
      )}
    </div>
  );
};
