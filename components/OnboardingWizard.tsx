import React, { useEffect, useState } from 'react';
import { IngestionMapper } from '../components/IngestionMapper';
import { api } from '../services/api';
import { Shield, Lock, Loader } from 'lucide-react';

interface OnboardingWizardProps {
    onNavigate: (view: string) => void;
    cartridge?: any;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onNavigate }) => {
    const [isCheckingStatus, setIsCheckingStatus] = useState(true);

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

    const handleIngestionComplete = async (payload: any) => {
        try {
            console.log("📜 Registering Schema:", payload);
            await api.ontology.registerSchema('PRODUCT', payload.fields || []);
            await api.ontology.lockSystem();
            console.log("✅ Constitution Locked!");
            onNavigate('command-center');
        } catch (error) {
            console.error("❌ Constitutional Failure:", error);
            alert("Failed to lock constitution. See console for details.");
        }
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
        // FIXED LAYOUT: Allow vertical scrolling, prevent horizontal overflow
        <div className="min-h-screen bg-slate-950 flex flex-col items-center py-12 px-6 relative overflow-x-hidden overflow-y-auto">

            {/* Background Decor (Fixed to prevent scroll jank) */}
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
                    Map your reality to the Auctorian Constitution.
                    Once locked, the schema becomes immutable laws for the AI.
                </p>
            </div>

            {/* The Constitutional Component */}
            <div className="w-full max-w-5xl relative z-10 mb-12">
                <IngestionMapper
                    title="Product Ontology"
                    description="Upload your Master Catalog (CSV) to define the Physics of your business."
                    onComplete={handleIngestionComplete}
                />
            </div>

            {/* Footer Status */}
            <div className="mt-auto relative z-10 flex items-center gap-2 text-slate-600 text-sm font-mono shrink-0">
                <Lock size={14} />
                <span>SYSTEM STATUS: UNLOCKED (EDITABLE)</span>
            </div>
        </div>
    );
};
