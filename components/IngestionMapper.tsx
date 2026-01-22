import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, X, Lock, AlertCircle, Sparkles, Settings } from 'lucide-react';
import { SchemaField } from '../types';

interface IngestionMapperProps {
  title: string;
  description: string;
  entityType: string;
  initialSchema?: SchemaField[];
  onComplete: (result: any) => void;
}

// CARTRIDGE-DEFINED STANDARD SCHEMAS (The \"Generic\" Targets)
// These MUST match the Anchor names defined in backend/core/dna.py
const STANDARD_SCHEMAS: Record<string, { column: string; datatype: string; display: string; required: boolean }[]> = {
  PRODUCT: [
    { column: 'ANCHOR_PRODUCT_ID', datatype: 'string', display: 'Product ID', required: true },
    { column: 'ANCHOR_PRODUCT_NAME', datatype: 'string', display: 'Product Name', required: true },
    { column: 'ANCHOR_CATEGORY', datatype: 'string', display: 'Category', required: false },
    { column: 'ANCHOR_RETAIL_PRICE', datatype: 'decimal', display: 'Retail Price', required: true },
    { column: 'cost_price', datatype: 'decimal', display: 'Cost Price', required: false },
    { column: 'ANCHOR_STOCK_ON_HAND', datatype: 'integer', display: 'Stock on Hand', required: false },
    { column: 'launch_date', datatype: 'date', display: 'Launch Date', required: false },
  ],
  TRANSACTION: [
    { column: 'transaction_id', datatype: 'string', display: 'Transaction ID', required: true },
    { column: 'ANCHOR_DATE', datatype: 'date', display: 'Transaction Date', required: true },
    { column: 'ANCHOR_PRODUCT_ID', datatype: 'string', display: 'Product ID', required: true },
    { column: 'store_id', datatype: 'string', display: 'Store ID', required: false },
    { column: 'ANCHOR_SALES_QTY', datatype: 'integer', display: 'Sales Quantity', required: true },
    { column: 'ANCHOR_SALES_VAL', datatype: 'decimal', display: 'Sales Value', required: false },
  ],
  INVENTORY: [
    { column: 'ANCHOR_PRODUCT_ID', datatype: 'string', display: 'Product ID', required: true },
    { column: 'ANCHOR_DATE', datatype: 'date', display: 'Snapshot Date', required: true },
    { column: 'ANCHOR_STOCK_ON_HAND', datatype: 'integer', display: 'Stock on Hand', required: true },
    { column: 'on_order', datatype: 'integer', display: 'On Order', required: false },
  ],
};

// Smart defaults for auto-detection
const detectDatatype = (values: string[]): string => {
  if (values.every(v => !isNaN(Number(v)) && !v.includes('.'))) return 'integer';
  if (values.every(v => !isNaN(Number(v)))) return 'decimal';
  if (values.every(v => /^\d{4}-\d{2}-\d{2}/.test(v))) return 'date';
  return 'string';
};

export const IngestionMapper: React.FC<IngestionMapperProps> = ({ title, description, entityType, initialSchema, onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [schemaFields, setSchemaFields] = useState<SchemaField[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const standardSchema = STANDARD_SCHEMAS[entityType] || [];

  // EDIT MODE: Hydrate from initialSchema
  useEffect(() => {
    if (initialSchema && initialSchema.length > 0) {
      const headers = initialSchema.map(f => f.source_column_name);
      setCsvHeaders(headers);
      setSchemaFields(initialSchema);
    }
  }, [initialSchema]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      parseCSV(selectedFile);
    }
  };

  const parseCSV = (file: File) => {
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

      // Auto-populate schema fields with smart defaults
      const autoFields: SchemaField[] = headers.map((header, idx) => {
        const sampleData = dataRows.map(row => row[idx]).filter(Boolean);
        const detectedType = detectDatatype(sampleData);

        // Smart defaults
        const isId = header.toLowerCase().includes('id');
        const isDate = header.toLowerCase().includes('date') || detectedType === 'date';
        const isCategory = header.toLowerCase().includes('category');
        const isDepartment = header.toLowerCase().includes('department') || header.toLowerCase().includes('dept');
        const isDivision = header.toLowerCase().includes('division') || header.toLowerCase().includes('div');

        return {
          source_column_name: header,
          source_column_datatype: detectedType,
          generic_column_name: '', // User must map
          generic_column_datatype: detectedType,
          display_name: header,
          is_pk: isId,
          is_hierarchy: isCategory || isDepartment || isDivision,
          hierarchy_level: isCategory ? 3 : isDepartment ? 2 : isDivision ? 1 : undefined,
          is_attribute: !isId && !isDate,
          is_partition_col: isDate,
          is_clustering_col: isId,
          is_null_allowed: true,
          required_in_product: isId,
        };
      });

      setSchemaFields(autoFields);
    };
    reader.readAsText(file.slice(0, 10000));
  };

  const updateField = (index: number, updates: Partial<SchemaField>) => {
    const updated = [...schemaFields];
    updated[index] = { ...updated[index], ...updates };
    setSchemaFields(updated);
  };

  const validateSchema = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Check for PK
    const hasPK = schemaFields.some(f => f.is_pk);
    if (!hasPK) errors.push('No Primary Key (is_pk) defined');

    // Check hierarchy levels are sequential
    const hierarchyFields = schemaFields.filter(f => f.is_hierarchy).sort((a, b) => (a.hierarchy_level || 0) - (b.hierarchy_level || 0));
    const levels = hierarchyFields.map(f => f.hierarchy_level).filter(Boolean);
    for (let i = 0; i < levels.length; i++) {
      if (levels[i] !== i + 1) {
        errors.push(`Hierarchy Level ${i + 1} is missing (cannot have Level ${levels[i]} without Level ${i + 1})`);
        break;
      }
    }

    // Check required fields are mapped
    const requiredCols = standardSchema.filter(s => s.required).map(s => s.column);
    const mappedGenericCols = schemaFields.map(f => f.generic_column_name).filter(Boolean);
    const missingRequired = requiredCols.filter(col => !mappedGenericCols.includes(col));
    if (missingRequired.length > 0) {
      errors.push(`Required fields not mapped: ${missingRequired.join(', ')}`);
    }

    return { valid: errors.length === 0, errors };
  };

  const handleSubmit = async () => {
    if (!file && !initialSchema) return;
    setIsSubmitting(true);
    setError(null);

    const validation = validateSchema();
    if (!validation.valid) {
      setError(validation.errors.join('; '));
      setIsSubmitting(false);
      return;
    }

    try {
      onComplete({ entityType, fields: schemaFields });
    } catch (err: any) {
      setError(err.message || "Schema Registration Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasActiveContext = !!file || (csvHeaders.length > 0 && !!initialSchema);

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-6">
        <h4 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="text-indigo-500" /> {title}
        </h4>
        <p className="text-sm text-slate-500">{description}</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2 border border-red-200">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* FILE UPLOAD */}
      {!hasActiveContext && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors p-8"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Upload size={40} />
          </div>
          <p className="font-bold text-slate-700 text-lg">Upload {entityType} Data</p>
          <p className="text-xs text-slate-400 mt-1">CSV only • Generic Schema Mapping Required</p>
          <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileChange} />
        </div>
      )}

      {/* METADATA TABLE */}
      {hasActiveContext && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Control Bar */}
          <div className="flex justify-between items-center p-4 bg-slate-50 border border-slate-200 rounded-lg mb-4 shrink-0">
            <div className="flex items-center gap-3">
              <FileText className="text-indigo-600" size={20} />
              <div>
                <div className="text-sm font-bold text-slate-800">
                  {file ? file.name : `Existing Schema: ${entityType}`}
                </div>
                <div className="text-xs text-slate-500">
                  {csvHeaders.length} columns • Mapping to {standardSchema.length} standard fields
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileChange} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md border border-indigo-200"
              >
                {file ? 'Change File' : 'Replace Source'}
              </button>
            </div>
          </div>

          {/* THE METADATA TABLE */}
          <div className="flex-1 overflow-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 sticky top-0">
                <tr>
                  <th className="p-3 text-left font-bold text-slate-700 border-b">Source Column</th>
                  <th className="p-3 text-left font-bold text-slate-700 border-b">Generic Target</th>
                  <th className="p-3 text-center font-bold text-slate-700 border-b">Type</th>
                  <th className="p-3 text-center font-bold text-slate-700 border-b">PK</th>
                  <th className="p-3 text-center font-bold text-slate-700 border-b">Hierarchy</th>
                  <th className="p-3 text-center font-bold text-slate-700 border-b">Level</th>
                  <th className="p-3 text-center font-bold text-slate-700 border-b">Partition</th>
                  <th className="p-3 text-center font-bold text-slate-700 border-b">Nullable</th>
                </tr>
              </thead>
              <tbody>
                {schemaFields.map((field, idx) => (
                  <tr key={idx} className="border-b hover:bg-slate-50">
                    <td className="p-3 font-mono text-xs">{field.source_column_name}</td>
                    <td className="p-3">
                      <input
                        type="text"
                        list={`generic-targets-${idx}`}
                        value={field.generic_column_name}
                        onChange={(e) => updateField(idx, { generic_column_name: e.target.value })}
                        placeholder="Select standard or type custom..."
                        className="w-full text-xs border rounded p-1.5 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                      />
                      <datalist id={`generic-targets-${idx}`}>
                        {standardSchema.map(s => (
                          <option key={s.column} value={s.column}>
                            {s.display} {s.required && '(Required)'}
                          </option>
                        ))}
                      </datalist>
                    </td>
                    <td className="p-3 text-center text-xs text-slate-500">{field.source_column_datatype}</td>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={field.is_pk}
                        onChange={(e) => updateField(idx, { is_pk: e.target.checked })}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={field.is_hierarchy}
                        onChange={(e) => updateField(idx, { is_hierarchy: e.target.checked })}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={field.hierarchy_level || ''}
                        onChange={(e) => updateField(idx, { hierarchy_level: e.target.value ? parseInt(e.target.value) : undefined })}
                        disabled={!field.is_hierarchy}
                        className="w-12 text-xs border rounded p-1 text-center disabled:bg-slate-100"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={field.is_partition_col}
                        onChange={(e) => updateField(idx, { is_partition_col: e.target.checked })}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={field.is_null_allowed}
                        onChange={(e) => updateField(idx, { is_null_allowed: e.target.checked })}
                        className="w-4 h-4"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* SUBMIT */}
          <div className="pt-6 mt-4 border-t border-slate-200 shrink-0">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full font-bold py-4 rounded-xl transition-all flex justify-center items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg"
            >
              {isSubmitting ? 'Registering Schema...' : (
                <>
                  <Lock size={18} />
                  <span>Register {entityType} Schema</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
