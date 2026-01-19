import React, { useState, useEffect } from 'react';
import { Sparkles, ShieldCheck, Loader } from 'lucide-react';
import { api } from '../services/api';
import { IngestionMapper } from '../components/IngestionMapper';

interface OnboardingWizardProps {
    onNavigate: (view: string) => void;
    cartridge?: any;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onNavigate }) => {
    const [isCheckingStatus, setIsCheckingStatus] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Safety Check: Prevent double-onboarding
    useEffect(() => {
        const checkSystemStatus = async () => {
            try {
                const status = await api.system.getStatus();

                // If system is already locked, redirect to command center
                if (status.is_locked) {
                    console.log('System already locked, redirecting to Command Center...');
                    onNavigate('command-center');
                    return;
                }

                setIsCheckingStatus(false);
            } catch (e) {
                console.error('Failed to check system status:', e);
                setError('Unable to connect to backend. Please start the server.');
                setIsCheckingStatus(false);
            }
        };

        checkSystemStatus();
    }, [onNavigate]);

    const handleIngestionComplete = async (result: any) => {
        try {
            // Step 1: Register the schema
            console.log('Registering schema...', result);
            await api.ontology.registerSchema('PRODUCT', result.fields || []);

            // Step 2: Lock the system (Phase 1 → Phase 2)
            console.log('Locking system...');
            await api.ontology.lockSystem();

            // Step 3: Navigate to Command Center
            console.log('Schema locked! Navigating to Command Center...');
            onNavigate('command-center');
        } catch (err: any) {
            console.error('Onboarding failed:', err);
            setError(err.message || 'Failed to complete onboarding');
        }
    };

    if (isCheckingStatus) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                <div className="text-center">
                    <Loader className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
                    <p className="text-slate-600 font-medium">Checking system status...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-red-200">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ShieldCheck size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">Connection Error</h2>
                    <p className="text-slate-600 text-center mb-6">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-all"
                    >
                        Retry Connection
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                            <Sparkles className="text-white" size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900">Auctorian Constitutional Wizard</h1>
                            <p className="text-sm text-slate-500">Phase 1: Define Your Reality</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-5xl mx-auto px-6 py-12">
                <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
                    <div className="p-8 h-[calc(100vh-280px)]">
                        <IngestionMapper
                            title="Product Master Upload"
                            description="Upload your Product CSV and map columns to Constitutional Anchors. This defines the 'Physics' of your enterprise."
                            onComplete={handleIngestionComplete}
                        />
                    </div>
                </div>

                {/* Info Footer */}
                <div className="mt-8 text-center">
                    <p className="text-slate-500 text-sm">
                        🔒 Your data will be validated against the{' '}
                        <span className="font-bold text-indigo-600">Auctorian Constitution</span> before being accepted.
                    </p>
                </div>
            </div>
        </div>
    );
};
