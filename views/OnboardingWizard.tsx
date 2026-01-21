import React, { useState, useEffect } from 'react';
import {
    Ing

estionMapper
} from '../components/IngestionMapper';
import { api } from '../services/api';
import { Shield, Lock, CheckCircle, Package, TrendingUp, Layers, Truck, ArrowRight, Plus, Trash2 } from 'lucide-react';
import { SchemaField } from '../types';

// CARTRIDGE DEF

INITIONS
const CARTRIDGES = [
    {
        id: 'RETAIL',
        name: 'Retail / CPG',
        description: 'Consumer-facing retail operations',
        icon: Package,
        status: 'ACTIVE' as const,
        supportedEntities: ['PRODUCT', 'TRANSACTION', 'INVENTORY']
    },
    {
        id: 'LOGISTICS',
        name: 'Logistics / Supply Chain',
        description: 'Warehouse & distribution management',
        icon: Truck,
        status: 'AVAILABLE' as const,
        supportedEntities: ['SHIPMENT', 'WAREHOUSE', 'ROUTE']
    },
];

// ENTITY DEFINITIONS (for selected cartridge)
const RETAIL_ENTITIES = [
    { id: 'PRODUCT', label: 'Product Master', description: 'Define the "What". SKUs, Pricing.', icon: Package },
    { id: 'TRANSACTION', label: 'Transaction Ledger', description: 'Define the "Flow". Sales, Receipts.', icon: TrendingUp },
    { id: 'INVENTORY', label: 'Inventory Snapshot', description: 'Define the "State". Stock on Hand.', icon: Layers },
];

export const OnboardingWizard: React.FC = () => {
    // STATE MACHINE: CARTRIDGE_SELECT -> ENTITY_SELECT -> MAPPER
    const [viewMode, setViewMode] = useState<'CARTRIDGE_SELECT' | 'ENTITY_SELECT' | 'MAPPER'>('CARTRIDGE_SELECT');

    // STATE
    const [selectedCartridge, setSelectedCartridge] = useState<string | null>(null);
    const [registeredSchemas, setRegisteredSchemas] = useState<Record<string, SchemaField[]>>({});
    const [activeEntityId, setActiveEntityId] = useState<string | null>(null);
    const [customEntityName, setCustomEntityName] = useState('');

    // INITIALIZATION: Load existing schemas
    useEffect(() => {
        const init = async () => {
            try {
                const registry = await api.ontology.getRegistry();
                setRegisteredSchemas(registry || {});

                // If schemas exist, assume cartridge is already selected (RETAIL by default)
                if (Object.keys(registry || {}).length > 0) {
                    setSelectedCartridge('RETAIL');
                    setViewMode('ENTITY_SELECT');
                }
            } catch (e) { console.error(e); }
        };
        init();
    }, []);

    // HANDLERS
    const handleCartridgeSelect = (id: string) => {
        const cartridge = CARTRIDGES.find(c => c.id === id);
        if (cartridge?.status !== 'ACTIVE') {
            alert('This cartridge is not yet available. Coming soon!');
            return;
        }
        setSelectedCartridge(id);
        setViewMode('ENTITY_SELECT');
    };

    const handleOpenMapper = (id: string) => {
        setActiveEntityId(id);
        setViewMode('MAPPER');
    };

    const handleIngestionComplete = async (payload: any) => {
        await api.ontology.registerSchema(payload.entityType, payload.fields);
        const registry = await api.ontology.getRegistry();
        setRegisteredSchemas(registry);
        setViewMode('ENTITY_SELECT');
        setActiveEntityId(null);
    };

    const handleFinalize = async () => {
        if (!registeredSchemas['PRODUCT']) return alert("Product Master is required.");
        await api.ontology.lockSystem();
        // Force full reload to trigger App.tsx lock check
        window.location.reload();
    };

    // RENDER: CARTRIDGE SELECT
    if (viewMode === 'CARTRIDGE_SELECT') {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center py-12 px-6">
                <div className="mb-12 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 text-xs font-mono mb-4">
                        <Shield size={12} className="text-emerald-400" /> <span>SECURE ENCLAVE // DOMAIN SELECTION</span>
                    </div>
                    <h1 className="text-4xl font-bold text-white mb-2">Select Your Domain</h1>
                    <p className="text-slate-400">Choose the operational context for your data</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
                    {CARTRIDGES.map(cart => {
                        const Icon = cart.icon;
                        const isAvailable = cart.status === 'ACTIVE';
                        return (
                            <div
                                key={cart.id}
                                onClick={() => isAvailable && handleCartridgeSelect(cart.id)}
                                className={`p-10 rounded-2xl border-2 transition-all ${isAvailable
                                        ? 'bg-slate-900 border-slate-700 cursor-pointer hover:border-indigo-500 hover:scale-105'
                                        : 'bg-slate-900/50 border-slate-800 opacity-60 cursor-not-allowed'
                                    }`}
                            >
                                <Icon className={isAvailable ? 'text-indigo-400' : 'text-slate-600'} size={48} />
                                <h3 className="text-2xl font-bold text-white mt-6">{cart.name}</h3>
                                <p className="text-slate-400 mt-2">{cart.description}</p>
                                {!isAvailable && <span className="inline-block mt-4 text-xs text-amber-500 font-bold">COMING SOON</span>}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // RENDER: MAPPER
    if (viewMode === 'MAPPER') {
        return (
            <div className="max-w-6xl mx-auto py-8 px-6 h-screen flex flex-col">
                <button onClick={() => setViewMode('ENTITY_SELECT')} className="mb-4 text-slate-500 hover:text-indigo-600 flex items-center gap-2 font-bold w-fit">
                    <ArrowRight className="rotate-180" size={18} /> Back to Entities
                </button>
                <div className="flex-1 bg-white rounded-2xl shadow-xl border border-slate-200 p-1 overflow-hidden">
                    <IngestionMapper
                        title={activeEntityId === 'CUSTOM' ? customEntityName : activeEntityId!}
                        description="Configure your schema mapping to the Auctorian standard."
                        entityType={activeEntityId === 'CUSTOM' ? customEntityName : activeEntityId!}
                        initialSchema={activeEntityId !== 'CUSTOM' ? registeredSchemas[activeEntityId!] : undefined}
                        onComplete={handleIngestionComplete}
                    />
                </div>
            </div>
        );
    }

    // RENDER: ENTITY SELECT (for selected cartridge)
    const entities = selectedCartridge === 'RETAIL' ? RETAIL_ENTITIES : [];

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center py-12 px-6">
            <div className="mb-12 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 text-xs font-mono mb-4">
                    <Shield size={12} className="text-emerald-400" /> <span>CARTRIDGE: {selectedCartridge}</span>
                </div>
                <h1 className="text-4xl font-bold text-white mb-2">Configure Data Entities</h1>
                <button onClick={() => setViewMode('CARTRIDGE_SELECT')} className="text-indigo-400 text-sm hover:underline">← Change Domain</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full max-w-6xl mb-12">
                {entities.map(entity => {
                    const isRegistered = !!registeredSchemas[entity.id];
                    const Icon = entity.icon;
                    return (
                        <div
                            key={entity.id}
                            onClick={() => handleOpenMapper(entity.id)}
                            className={`p-6 rounded-2xl border cursor-pointer hover:scale-105 transition-all ${isRegistered ? 'bg-emerald-900/20 border-emerald-500' : 'bg-slate-900 border-slate-800'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <Icon className={isRegistered ? 'text-emerald-400' : 'text-slate-400'} size={24} />
                                {isRegistered && <CheckCircle className="text-emerald-400" size={20} />}
                            </div>
                            <h3 className="text-white font-bold">{entity.label}</h3>
                            <p className="text-slate-400 text-sm mt-1">{entity.description}</p>
                            {isRegistered && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm('Delete schema?')) {
                                            api.ontology.deleteSchema(entity.id).then(() => {
                                                const u = { ...registeredSchemas };
                                                delete u[entity.id];
                                                setRegisteredSchemas(u);
                                            });
                                        }
                                    }}
                                    className="absolute top-2 right-2 text-slate-600 hover:text-red-500"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    );
                })}

                {/* Custom Entity */}
                <div
                    onClick={() => {
                        const name = prompt("Entity Name:");
                        if (name) {
                            setCustomEntityName(name.toUpperCase());
                            handleOpenMapper('CUSTOM');
                        }
                    }}
                    className="p-6 rounded-2xl border border-dashed border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:border-slate-500"
                >
                    <Plus className="text-slate-400 mb-2" />
                    <span className="text-slate-400 font-bold">Add Custom</span>
                </div>
            </div>

            <button
                onClick={handleFinalize}
                disabled={!registeredSchemas['PRODUCT']}
                className="px-12 py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
                <Lock size={20} /> Initialize Sovereign Brain
            </button>
        </div>
    );
};

export default OnboardingWizard;
