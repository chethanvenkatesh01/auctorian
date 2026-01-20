import React, { useEffect, useState } from 'react';
import { IngestionMapper } from '../components/IngestionMapper';
import { api } from '../services/api';
import { Shield, Lock, Loader, Package, TrendingUp, Layers, Database, ArrowRight, CheckCircle, Rocket, Trash2, Edit } from 'lucide-react';
import { SchemaField } from '../types';

interface OnboardingWizardProps {
    onNavigate: (view: string) => void;
    cartridge?: any;
}

interface CartridgeOption {
    id: string;
    name: string;
    description: string;
    icon: React.ElementType;
    entityType: string;
    color: string;
}

interface StagedEntity {
    entityType: string;
    name: string;
    fields: SchemaField[];
    color: string;
    icon: React.ElementType;
}

const CARTRIDGE_OPTIONS: CartridgeOption[] = [
    {
        id: 'product',
        name: 'Product Master',
        description: 'SKUs, Catalog, Attributes',
        icon: Package,
        entityType: 'PRODUCT',
        color: 'from-indigo-500 to-purple-600'
    },
    {
        id: 'transaction',
        name: 'Transaction Ledger',
        description: 'Sales, Orders, Activity',
        icon: TrendingUp,
        entityType: 'TRANSACTION',
        color: 'from-rose-500 to-pink-600'
    },
    {
        id: 'inventory',
        name: 'Inventory Snapshot',
        description: 'Stock Levels, Warehouses',
        icon: Layers,
        entityType: 'INVENTORY',
        color: 'from-emerald-500 to-teal-600'
    },
    {
        id: 'custom',
        name: 'Custom / Auxiliary',
        description: 'Stores, Promos, etc.',
        icon: Database,
        entityType: 'CUSTOM',
        color: 'from-amber-500 to-orange-600'
    }
];

// View Mode State for Navigation
type ViewMode = 'HIERARCHY' | 'CARTRIDGES' | 'MAPPER';

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onNavigate }) => {
    const [isCheckingStatus, setIsCheckingStatus] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('CARTRIDGES');
    const [selectedCartridge, setSelectedCartridge] = useState<CartridgeOption | null>(null);
    const [customEntityName, setCustomEntityName] = useState('');
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [stagedEntities, setStagedEntities] = useState<StagedEntity[]>([]);
    const [registeredSchemas, setRegisteredSchemas] = useState<Record<string, SchemaField[]>>({});
    const [isLocking, setIsLocking] = useState(false);
    const [editingEntity, setEditingEntity] = useState<string | null>(null);

    // STATE HYDRATION: Load existing schemas on mount
    useEffect(() => {
        const init = async () => {
            try {
                const status = await api.system.getStatus();
                if (status.is_locked) {
                    console.log("System already locked, redirecting...");
                    onNavigate('command-center');
                    return;
                }

                // Load existing schemas from registry
                try {
                    const registry = await api.ontology.getRegistry();
                    setRegisteredSchemas(registry);

                    // Reconstruct staged entities from registry
                    const staged: StagedEntity[] = Object.entries(registry).map(([entityType, fields]) => {
                        const matchingCartridge = CARTRIDGE_OPTIONS.find(c => c.entityType === entityType);
                        return {
                            entityType,
                            name: matchingCartridge?.name || entityType,
                            fields: fields as SchemaField[],
                            color: matchingCartridge?.color || 'from-slate-500 to-slate-600',
                            icon: matchingCartridge?.icon || Database
                        };
                    });
                    setStagedEntities(staged);
                    console.log(`📋 Hydrated ${staged.length} existing schemas`);
                } catch (e) {
                    console.error("Failed to load registry:", e);
                }

                setIsCheckingStatus(false);
            } catch (e) {
                console.error("System check failed", e);
                setIsCheckingStatus(false);
            }
        };
        init();
    }, [onNavigate]);

    const handleCartridgeSelect = (cartridge: CartridgeOption) => {
        if (cartridge.id === 'custom') {
            setShowCustomInput(true);
        } else {
            setSelectedCartridge(cartridge);
            setEditingEntity(null); // New entity
            setViewMode('MAPPER');
        }
    };

    const handleEditEntity = (entity: StagedEntity) => {
        const matchingCartridge = CARTRIDGE_OPTIONS.find(c => c.entityType === entity.entityType);
        // Should also support custom entities reconstruction
        const cartridgeToUse = matchingCartridge || {
            id: 'custom',
            name: entity.name,
            description: 'Existing Custom Entity',
            icon: Database,
            entityType: entity.entityType,
            color: entity.color
        };

        setSelectedCartridge(cartridgeToUse);
        setEditingEntity(entity.entityType);
        setViewMode('MAPPER');
    };

    const handleCustomEntitySubmit = () => {
        if (!customEntityName.trim()) {
            alert('Please enter an entity name');
            return;
        }

        const customCartridge: CartridgeOption = {
            id: 'custom',
            name: customEntityName,
            description: 'Custom Auxiliary Entity',
            icon: Database,
            entityType: customEntityName.toUpperCase().replace(/[^A-Z0-9]/g, '_'),
            color: 'from-amber-500 to-orange-600'
        };

        setSelectedCartridge(customCartridge);
        setShowCustomInput(false);
        setEditingEntity(null);
        setViewMode('MAPPER');
    };

    const handleIngestionComplete = async (payload: any) => {
        try {
            console.log("📜 Staging Schema:", payload);

            // Stage the entity
            const stagedEntity: StagedEntity = {
                entityType: payload.entityType,
                name: selectedCartridge?.name || payload.entityType,
                fields: payload.fields,
                color: selectedCartridge?.color || 'from-slate-500 to-slate-600',
                icon: selectedCartridge?.icon || Database
            };

            // Update or add to staged entities
            setStagedEntities(prev => {
                const filtered = prev.filter(e => e.entityType !== payload.entityType);
                return [...filtered, stagedEntity];
            });

            // Update registered schemas
            setRegisteredSchemas(prev => ({
                ...prev,
                [payload.entityType]: payload.fields
            }));

            // Return to staging area
            setSelectedCartridge(null);
            setEditingEntity(null);
            setViewMode('CARTRIDGES');
        } catch (error) {
            console.error("❌ Staging Failure:", error);
            alert("Failed to stage schema. See console for details.");
        }
    };

    const handleDeleteSchema = async (entityType: string) => {
        if (!confirm(`Delete ${entityType} schema? This cannot be undone.`)) return;

        try {
            await api.ontology.deleteSchema(entityType);

            // Remove from local state
            const updated = { ...registeredSchemas };
            delete updated[entityType];
            setRegisteredSchemas(updated);

            // Remove from staged entities
            setStagedEntities(prev => prev.filter(e => e.entityType !== entityType));

            console.log(`🗑️ Deleted ${entityType}`);
        } catch (e: any) {
            alert(`Failed to delete: ${e.message || e}`);
        }
    };

    const handleFinalize = async () => {
        if (stagedEntities.length === 0) {
            alert('Please stage at least one entity first');
            return;
        }

        setIsLocking(true);
        try {
            // Register all staged entities
            for (const entity of stagedEntities) {
                console.log(`📜 Registering ${entity.entityType}...`);
                await api.ontology.registerSchema(entity.entityType, entity.fields);
            }

            // Lock the system
            console.log("🔒 Locking Constitution...");
            await api.ontology.lockSystem();

            console.log("✅ Sovereign Brain Initialized!");
            onNavigate('command-center');
        } catch (error) {
            console.error("❌ Finalization Failed:", error);
            alert("Failed to initialize system. See console for details.");
            setIsLocking(false);
        }
    };

    const handleBack = () => {
        setSelectedCartridge(null);
        setEditingEntity(null);
        setViewMode('CARTRIDGES');
    };

    if (isCheckingStatus) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <Loader className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
                    <p className="text-slate-400 font-medium">Checking system status...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center py-12 px-6 relative overflow-x-hidden overflow-y-auto">
            {/* Background Decor */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />
                <div className="absolute -top-20 -left-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
            </div>

            {/* Header */}
            <div className="mb-8 text-center relative z-10 shrink-0">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 text-xs font-mono mb-4">
                    <Shield size={12} className="text-emerald-400" />
                    <span>SECURE ENCLAVE // ONTOLOGY MANAGER</span>
                </div>
                <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
                    Constitutional Ontology Manager
                </h1>
                <p className="text-slate-400 max-w-lg mx-auto">
                    {viewMode === 'CARTRIDGES'
                        ? 'Manage your data schemas. Edit, delete, or add new entities.'
                        : `Configure ${selectedCartridge?.name} schema.`
                    }
                </p>
            </div>

            {/* Step 0: Staging Area */}
            {viewMode === 'CARTRIDGES' && (
                <div className="w-full max-w-5xl relative z-10 mb-12 space-y-8">
                    {/* Staged Entities Dashboard */}
                    {stagedEntities.length > 0 && (
                        <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <CheckCircle className="text-emerald-400" size={24} />
                                Active Entities ({stagedEntities.length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {stagedEntities.map((entity) => {
                                    const Icon = entity.icon;
                                    return (
                                        <div key={entity.entityType} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 relative group">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3 flex-1">
                                                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${entity.color} flex items-center justify-center shrink-0`}>
                                                        <Icon className="text-white" size={24} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="text-white font-bold">{entity.name}</div>
                                                        <div className="text-slate-400 text-xs">{entity.fields.length} fields mapped</div>
                                                        <div className="text-emerald-400 text-xs font-medium mt-1">✓ Active</div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleEditEntity(entity)}
                                                        className="text-indigo-400 hover:text-indigo-300 p-2"
                                                        title="Edit"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteSchema(entity.entityType)}
                                                        className="text-red-400 hover:text-red-300 p-2"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Add More Entities */}
                    <div>
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Package className="text-indigo-400" size={20} />
                            Add Entity Type
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {CARTRIDGE_OPTIONS.map((cartridge) => {
                                const Icon = cartridge.icon;
                                const isActive = !!registeredSchemas[cartridge.entityType] && cartridge.id !== 'custom';
                                return (
                                    <button
                                        key={cartridge.id}
                                        onClick={() => !isActive && handleCartridgeSelect(cartridge)}
                                        className={`group relative bg-slate-900/50 backdrop-blur-sm border rounded-2xl p-8 transition-all ${isActive
                                            ? 'border-emerald-700 opacity-75'
                                            : 'border-slate-800 hover:border-slate-700 hover:scale-105'
                                            }`}
                                    >
                                        <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${cartridge.color} flex items-center justify-center mb-4 shadow-lg ${!isActive && 'group-hover:shadow-xl'} transition-shadow`}>
                                            <Icon className="text-white" size={32} />
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-2">{cartridge.name}</h3>
                                        <p className="text-slate-400 text-sm">{cartridge.description}</p>
                                        {isActive && (
                                            <div className="absolute top-4 right-4 text-emerald-400 text-xs font-bold">
                                                ✓ Active
                                            </div>
                                        )}
                                        {!isActive && (
                                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <ArrowRight className="text-slate-500" size={20} />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Finalize Button */}
                    {stagedEntities.length > 0 && (
                        <div className="mt-8">
                            <button
                                onClick={handleFinalize}
                                disabled={isLocking}
                                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold py-6 rounded-2xl hover:shadow-2xl hover:shadow-emerald-500/20 transition-all flex items-center justify-center gap-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLocking ? (
                                    <>
                                        <Loader className="animate-spin" size={24} />
                                        <span>Initializing Sovereign Brain...</span>
                                    </>
                                ) : (
                                    <>
                                        <Rocket size={24} />
                                        <span>Initialize Sovereign Brain & Lock Constitution</span>
                                        <Lock size={24} />
                                    </>
                                )}
                            </button>
                            <p className="text-center text-slate-500 text-xs mt-3">
                                This will register {stagedEntities.length} {stagedEntities.length === 1 ? 'entity' : 'entities'} and make the schema immutable.
                            </p>
                        </div>
                    )}

                    {/* Custom Entity Input Modal */}
                    {showCustomInput && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full mx-4">
                                <h3 className="text-2xl font-bold text-white mb-4">Define Custom Entity</h3>
                                <p className="text-slate-400 text-sm mb-6">
                                    Enter a name for your custom entity (e.g., "Stores", "Promotions", "Suppliers")
                                </p>
                                <input
                                    type="text"
                                    value={customEntityName}
                                    onChange={(e) => setCustomEntityName(e.target.value)}
                                    placeholder="Entity Name"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 mb-6 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    onKeyPress={(e) => e.key === 'Enter' && handleCustomEntitySubmit()}
                                />
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            setShowCustomInput(false);
                                            setCustomEntityName('');
                                        }}
                                        className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleCustomEntitySubmit}
                                        className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all font-bold"
                                    >
                                        Continue
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Step 2: Mapper */}
            {viewMode === 'MAPPER' && selectedCartridge && (
                <>
                    <div className="w-full max-w-5xl relative z-10 mb-4">
                        <button
                            onClick={handleBack}
                            className="text-slate-400 hover:text-white text-sm font-medium flex items-center gap-2"
                        >
                            ← Back to Ontology Manager
                        </button>
                    </div>

                    <div className="w-full max-w-5xl relative z-10 mb-12 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-8">
                        <IngestionMapper
                            title={selectedCartridge.name}
                            description={selectedCartridge.description}
                            entityType={selectedCartridge.entityType}
                            initialSchema={editingEntity ? registeredSchemas[editingEntity] : undefined}
                            onComplete={handleIngestionComplete}
                        />
                    </div>
                </>
            )}

            {/* Footer Status */}
            <div className="mt-auto relative z-10 flex items-center gap-2 text-slate-600 text-sm font-mono shrink-0">
                <Lock size={14} />
                <span>SYSTEM STATUS: UNLOCKED ({stagedEntities.length} entities configured)</span>
            </div>
        </div>
    );
};
