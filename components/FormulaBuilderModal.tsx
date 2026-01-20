import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Divide, Asterisk, Calculator, AlertCircle } from 'lucide-react';

interface FormulaBuilderModalProps {
    isOpen: boolean;
    onClose: () => void;
    fieldName: string;
    availableFields: string[]; // Anchor names
    sampleData: Record<string, string>; // First row data for preview
    onSave: (formula: string) => void;
}

export const FormulaBuilderModal: React.FC<FormulaBuilderModalProps> = ({
    isOpen,
    onClose,
    fieldName,
    availableFields,
    sampleData,
    onSave
}) => {
    const [formula, setFormula] = useState('');
    const [previewResult, setPreviewResult] = useState<string | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);

    useEffect(() => {
        if (formula) {
            calculatePreview();
        } else {
            setPreviewResult(null);
            setPreviewError(null);
        }
    }, [formula, sampleData]);

    const calculatePreview = () => {
        try {
            // Parse formula: Replace [Field Name] with actual values
            let evalFormula = formula;

            availableFields.forEach(field => {
                const placeholder = `[${field}]`;
                const value = sampleData[field] || '0';
                const numericValue = parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
                evalFormula = evalFormula.replace(new RegExp(`\\[${field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'g'), numericValue.toString());
            });

            // Evaluate the formula safely
            const result = Function(`"use strict"; return (${evalFormula})`)();

            if (isNaN(result) || !isFinite(result)) {
                setPreviewError('Invalid result');
                setPreviewResult(null);
            } else {
                setPreviewResult(result.toFixed(2));
                setPreviewError(null);
            }
        } catch (e: any) {
            setPreviewError(e.message || 'Invalid formula');
            setPreviewResult(null);
        }
    };

    const addToFormula = (value: string) => {
        setFormula(prev => prev + value);
    };

    const addField = (field: string) => {
        addToFormula(`[${field}]`);
    };

    const handleSave = () => {
        if (!formula) {
            alert('Please build a formula first');
            return;
        }
        if (previewError) {
            alert('Formula has errors. Please fix before saving.');
            return;
        }
        onSave(formula);
        setFormula('');
        onClose();
    };

    const handleClear = () => {
        setFormula('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-4 flex items-center justify-between rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <Calculator size={24} />
                        <div>
                            <h3 className="text-xl font-bold">Formula Builder</h3>
                            <p className="text-sm text-indigo-100">Define calculation for: {fieldName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Formula Display */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Formula Expression</label>
                        <div className="bg-slate-50 border-2 border-slate-200 rounded-lg p-4 min-h-[80px] font-mono text-slate-900">
                            {formula || <span className="text-slate-400">Build your formula using fields and operators...</span>}
                        </div>
                        <button
                            onClick={handleClear}
                            className="mt-2 text-xs text-red-600 hover:text-red-700 font-medium"
                        >
                            Clear Formula
                        </button>
                    </div>

                    {/* Live Preview */}
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Calculator size={16} className="text-emerald-700" />
                            <span className="text-sm font-bold text-emerald-700">Live Preview (Row 1)</span>
                        </div>
                        {previewResult && (
                            <div className="text-2xl font-bold text-emerald-700">
                                Result: {previewResult}
                            </div>
                        )}
                        {previewError && (
                            <div className="flex items-center gap-2 text-red-700">
                                <AlertCircle size={16} />
                                <span className="text-sm font-medium">{previewError}</span>
                            </div>
                        )}
                        {!previewResult && !previewError && formula && (
                            <div className="text-sm text-slate-500">Calculating...</div>
                        )}
                        {!formula && (
                            <div className="text-sm text-slate-500">No formula yet</div>
                        )}
                    </div>

                    {/* Available Fields */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-3">Available Fields</label>
                        <div className="flex flex-wrap gap-2">
                            {availableFields.map(field => (
                                <button
                                    key={field}
                                    onClick={() => addField(field)}
                                    className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors border border-indigo-200"
                                >
                                    {field}
                                    {sampleData[field] && (
                                        <span className="ml-2 text-xs text-indigo-500">({sampleData[field]})</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Operators */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-3">Operators</label>
                        <div className="grid grid-cols-4 gap-2">
                            <button
                                onClick={() => addToFormula(' + ')}
                                className="flex items-center justify-center gap-2 p-4 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold text-slate-700 transition-colors"
                            >
                                <Plus size={20} /> Add
                            </button>
                            <button
                                onClick={() => addToFormula(' - ')}
                                className="flex items-center justify-center gap-2 p-4 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold text-slate-700 transition-colors"
                            >
                                <Minus size={20} /> Subtract
                            </button>
                            <button
                                onClick={() => addToFormula(' * ')}
                                className="flex items-center justify-center gap-2 p-4 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold text-slate-700 transition-colors"
                            >
                                <Asterisk size={20} /> Multiply
                            </button>
                            <button
                                onClick={() => addToFormula(' / ')}
                                className="flex items-center justify-center gap-2 p-4 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold text-slate-700 transition-colors"
                            >
                                <Divide size={20} /> Divide
                            </button>
                            <button
                                onClick={() => addToFormula('(')}
                                className="p-4 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold text-slate-700 transition-colors text-xl"
                            >
                                (
                            </button>
                            <button
                                onClick={() => addToFormula(')')}
                                className="p-4 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold text-slate-700 transition-colors text-xl"
                            >
                                )
                            </button>
                        </div>
                    </div>

                    {/* Example */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                        <p className="font-bold text-blue-900 mb-2">Example Formula:</p>
                        <code className="text-blue-700">
                            [ANCHOR_RETAIL_PRICE] - [ANCHOR_COST]
                        </code>
                        <p className="text-blue-600 mt-2 text-xs">
                            This calculates margin by subtracting cost from retail price.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!formula || !!previewError}
                        className={`px-6 py-3 rounded-lg font-bold transition-all ${formula && !previewError
                                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        Save Formula
                    </button>
                </div>
            </div>
        </div>
    );
};
