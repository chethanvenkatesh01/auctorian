// views/OnboardingWizard.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IngestionMapper } from '../components/IngestionMapper';
import { api } from '../services/api';
import { Shield, Lock, Layers, CheckCircle, ArrowRight, Package, TrendingUp, Plus, Trash2 } from 'lucide-react';
import { SchemaField } from '../types';

const CARTRIDGES = [
    { id: 'PRODUCT', label: 'Product Master', description: 'Define the "What". SKUs, Pricing.', icon: Package },
    { id: 'TRANSACTION', label: 'Transaction Ledger', description: 'Define the "Flow". Sales, Receipts.', icon: TrendingUp },
    { id: 'INVENTORY', label: 'Inventory Snapshot', description: 'Define the "State". Stock on Hand.', icon: Layers },
];

export const OnboardingWizard: React.FC = () => {
    const navigate = useNavigate();
    // STATE MACHINE: HIERARCHY -> CARTRIDGES -> MAPPER
    const [viewMode, setViewMode] = useState<'HIERARCHY' | 'CARTRIDGES' | 'MAPPER'>('HIERARCHY');

    // STATE
    const [prodLevels, setProdLevels] = useState<string[]>(['Category', 'Product']);
    const [locLevels, setLocLevels] = useState<string[]>(['Region', 'Store']);
    const [registeredSchemas, setRegisteredSchemas] = useState<Record<string, SchemaField[]>>({});
    const [activeCartridgeId, setActiveCartridgeId] = useState<string | null>(null);
    const [customEntityName, setCustomEntityName] = useState('');

    // INITIALIZATION
    useEffect(() => {
        const init = async () => {
            try {
                const pStruct = await api.ontology.getStructure('PRODUCT');
                const lStruct = await api.ontology.getStructure('LOCATION');
                const registry = await api.ontology.getRegistry();

                setRegisteredSchemas(registry || {});

                // Auto-skip to Cartridges if hierarchy is already defined
                if (pStruct?.length && lStruct?.length) {
                    setProdLevels(pStruct);
                    setLocLevels(lStruct);
                    setViewMode('CARTRIDGES');
                }
            } catch (e) { console.error(e); }
        };
        init();
    }, []);

    // HANDLERS
    const handleHierarchySave = async () => {
        await api.ontology.defineStructure(prodLevels);
        await api.ontology.defineLocationStructure(locLevels);
        setViewMode('CARTRIDGES');
    };

    const handleOpenMapper = (id: string) => {
        setActiveCartridgeId(id);
        setViewMode('MAPPER');
    };

    const handleIngestionComplete = async (payload: any) => {
        await api.ontology.registerSchema(payload.entityType, payload.fields);
        const registry = await api.ontology.getRegistry();
        setRegisteredSchemas(registry);
        setViewMode('CARTRIDGES');
        setActiveCartridgeId(null);
    };

    const handleFinalize = async () => {
        if (!registeredSchemas['PRODUCT']) return alert("Product Master is required.");
        await api.ontology.lockSystem();
        // Force full reload to trigger App.tsx lock check
        window.location.reload();
    };

    // RENDER: HIERARCHY
    if (viewMode === 'HIERARCHY') {
        return (
            <div className="max-w-4xl mx-auto py-12 px-6 text-center">
                <h1 className="text-3xl font-black text-slate-900 mb-8">Step 1: Define Reality</h1>
                <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
                    {/* Simple Inputs for Hierarchy */}
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="p-4 bg-slate-50 rounded">
                            <h3 className="font-bold mb-2">Product Hierarchy</h3>
                            {prodLevels.map((l, i) => (
                                <input key={i} value={l} onChange={(e) => {
                                    const n = [...prodLevels]; n[i] = e.target.value; setProdLevels(n);
                                }} className="w-full p-2 border rounded mb-2" />
                            ))}
                            <button onClick={() => setProdLevels([...prodLevels, 'Level'])} className="text-xs text-indigo-600 font-bold">+ Add Level</button>
                        </div>
                        <div className="p-4 bg-slate-50 rounded">
                            <h3 className="font-bold mb-2">Location Hierarchy</h3>
                            {locLevels.map((l, i) => (
                                <input key={i} value={l} onChange={(e) => {
                                    const n = [...locLevels]; n[i] = e.target.value; setLocLevels(n);
                                }} className="w-full p-2 border rounded mb-2" />
                            ))}
                            <button onClick={() => setLocLevels([...locLevels, 'Level'])} className="text-xs text-emerald-600 font-bold">+ Add Level</button>
                        </div>
                    </div>
                    <button onClick={handleHierarchySave} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold">
                        Confirm & Continue
                    </button>
                </div>
            </div>
        );
    }

    // RENDER: MAPPER
    if (viewMode === 'MAPPER') {
        return (
            <div className="max-w-6xl mx-auto py-8 px-6 h-screen flex flex-col">
                <button onClick={() => setViewMode('CARTRIDGES')} className="mb-4 text-slate-500 hover:text-indigo-600 flex items-center gap-2 font-bold w-fit">
                    <ArrowRight className="rotate-180" size={18} /> Back to Cartridges
                </button>
                <div className="flex-1 bg-white rounded-2xl shadow-xl border border-slate-200 p-1 overflow-hidden">
                    <IngestionMapper
                        title={activeCartridgeId === 'CUSTOM' ? customEntityName : activeCartridgeId!}
                        description="Map your source file to the Auctorian Constitution."
                        entityType={activeCartridgeId === 'CUSTOM' ? customEntityName : activeCartridgeId!}
                        initialSchema={activeCartridgeId !== 'CUSTOM' ? registeredSchemas[activeCartridgeId!] : undefined}
                        onComplete={handleIngestionComplete}
                    />
                </div>
            </div>
        );
    }

    // RENDER: CARTRIDGES
    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center py-12 px-6">
            <div className="mb-12 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 text-xs font-mono mb-4">
                    <Shield size={12} className="text-emerald-400" /> <span>SECURE ENCLAVE // DATA INGESTION</span>
                </div>
                <h1 className="text-4xl font-bold text-white mb-2">Load Knowledge Cartridges</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full max-w-6xl mb-12">
                {CARTRIDGES.map(cart => {
                    const isActive = !!registeredSchemas[cart.id];
                    return (
                        <div key={cart.id} onClick={() => handleOpenMapper(cart.id)} className={`p-6 rounded-2xl border cursor-pointer hover:scale-105 transition-all relative ${isActive ? 'bg-emerald-900/20 border-emerald-500' : 'bg-slate-900 border-slate-800'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <cart.icon className={isActive ? 'text-emerald-400' : 'text-slate-400'} size={24} />
                                {isActive && <CheckCircle className="text-emerald-400" size={20} />}
                            </div>
                            <h3 className="text-white font-bold">{cart.label}</h3>
                            <p className="text-slate-400 text-sm mt-1">{cart.description}</p>
                            {isActive && (
                                <button onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('Delete?')) {
                                        api.ontology.deleteSchema(cart.id).then(() => {
                                            const u = { ...registeredSchemas }; delete u[cart.id]; setRegisteredSchemas(u);
                                        });
                                    }
                                }} className="absolute top-2 right-2 text-slate-600 hover:text-red-500"><Trash2 size={14} /></button>
                            )}
                        </div>
                    );
                })}
                {/* Custom Card Logic */}
                <div onClick={() => {
                    const name = prompt("Entity Name:");
                    if (name) { setCustomEntityName(name.toUpperCase()); handleOpenMapper('CUSTOM'); }
                }} className="p-6 rounded-2xl border border-dashed border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:border-slate-500">
                    <Plus className="text-slate-400 mb-2" />
                    <span className="text-slate-400 font-bold">Add Custom</span>
                </div>
            </div>

            <button onClick={handleFinalize} disabled={!registeredSchemas['PRODUCT']} className="px-12 py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                <Lock size={20} /> Initialize Sovereign Brain
            </button>
        </div>
    );
};
