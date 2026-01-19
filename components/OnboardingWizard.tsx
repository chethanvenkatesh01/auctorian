import React, { useEffect, useState } from 'react';
import { IngestionMapper } from '../components/IngestionMapper';
import { api } from '../services/api';
import { Shield, Lock, Loader, Package, TrendingUp, Layers, Database, ArrowRight } from 'lucide-react';

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

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onNavigate }) => {
    const [isCheckingStatus, setIsCheckingStatus] = useState(true);
    const [currentStep, setCurrentStep] = useState(0); // 0 = selector, 1 = mapper
    const [selectedCartridge, setSelectedCartridge] = useState<CartridgeOption | null>(null);
    const [customEntityName, setCustomEntityName] = useState('');
    const [showCustomInput, setShowCustomInput] = useState(false);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const status = await api.system.getStatus();
                if (status.is_locked) {
                    console.log("System already locked, redirecting...");
                    onNavigate('command-center');
                    return;
                }
                setIsCheckingStatus(false);
            } catch (e) {
                console.error("System check failed", e);
                setIsCheckingStatus(false);
            }
        };
        checkStatus();
    }, [onNavigate]);

    const handleCartridgeSelect = (cartridge: CartridgeOption) => {
        if (cartridge.id === 'custom') {
            setShowCustomInput(true);
        } else {
            setSelectedCartridge(cartridge);
            setCurrentStep(1);
        }
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
        setCurrentStep(1);
    };

    const handleIngestionComplete = async (payload: any) => {
        try {
            console.log("📜 Registering Schema:", payload);
            await api.ontology.registerSchema(payload.entityType, payload.fields);

            // For now, just go to command center after first entity
            // In future, could loop back to Step 0 to add more entities
            await api.ontology.lockSystem();
            console.log("✅ Constitution Locked!");
            onNavigate('command-center');
        } catch (error) {
            console.error("❌ Constitutional Failure:", error);
            alert("Failed to register schema. See console for details.");
        }
    };

    const handleBack = () => {
        setSelectedCartridge(null);
        setCurrentStep(0);
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
                    <span>SECURE ENCLAVE // CONSTITUTIONAL PHASE</span>
                </div>
                <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
                    Initialize Sovereign Node
                </h1>
                <p className="text-slate-400 max-w-lg mx-auto">
                    {currentStep === 0
                        ? 'Select the type of data you want to onboard first.'
                        : `Map your ${selectedCartridge?.name} to the Auctorian Constitution.`
                    }
                </p>
            </div>

            {/* Step 0: Cartridge Selector */}
            {currentStep === 0 && (
                <div className="w-full max-w-5xl relative z-10 mb-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {CARTRIDGE_OPTIONS.map((cartridge) => {
                            const Icon = cartridge.icon;
                            return (
                                <button
                                    key={cartridge.id}
                                    onClick={() => handleCartridgeSelect(cartridge)}
                                    className="group relative bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-8 hover:border-slate-700 transition-all hover:scale-105"
                                >
                                    <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${cartridge.color} flex items-center justify-center mb-4 shadow-lg group-hover:shadow-xl transition-shadow`}>
                                        <Icon className="text-white" size={32} />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">{cartridge.name}</h3>
                                    <p className="text-slate-400 text-sm">{cartridge.description}</p>
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ArrowRight className="text-slate-500" size={20} />
                                    </div>
                                </button>
                            );
                        })}
                    </div>

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

            {/* Step 1: Mapper */}
            {currentStep === 1 && selectedCartridge && (
                <>
                    {/* Back Button */}
                    <div className="w-full max-w-5xl relative z-10 mb-4">
                        <button
                            onClick={handleBack}
                            className="text-slate-400 hover:text-white text-sm font-medium flex items-center gap-2"
                        >
                            ← Back to Cartridge Selection
                        </button>
                    </div>

                    <div className="w-full max-w-5xl relative z-10 mb-12 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-8">
                        <IngestionMapper
                            title={selectedCartridge.name}
                            description={selectedCartridge.description}
                            entityType={selectedCartridge.entityType}
                            onComplete={handleIngestionComplete}
                        />
                    </div>
                </>
            )}

            {/* Footer Status */}
            <div className="mt-auto relative z-10 flex items-center gap-2 text-slate-600 text-sm font-mono shrink-0">
                <Lock size={14} />
                <span>SYSTEM STATUS: UNLOCKED (EDITABLE)</span>
            </div>
        </div>
    );
};
