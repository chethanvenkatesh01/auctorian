import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import { OnboardingWizard } from './views/OnboardingWizard';
import { CommandCenter } from './views/CommandCenter';
import { DebateConsole } from './views/DebateConsole';
import DecisionWorkbench from './views/DecisionWorkbench';
import IntelligenceView from './views/IntelligenceView';
import DataPlaneView from './views/DataPlaneView';
import GovernanceView from './views/GovernanceView';
import LearningLoopView from './views/LearningLoopView';
import { api } from './services/api';

const App: React.FC = () => {
    const [isLocked, setIsLocked] = useState<boolean | null>(null); // Null = Loading
    const [currentView, setCurrentView] = useState('command-center');

    // 1. BOOT SEQUENCE: CHECK LIFECYCLE STATE
    useEffect(() => {
        const checkSystem = async () => {
            const status = await api.system.getStatus();
            setIsLocked(status.is_locked);
        };
        checkSystem();
    }, []);

    // 2. LOADING STATE
    if (isLocked === null) {
        return <div className="h-screen bg-slate-900 flex items-center justify-center text-slate-500 font-mono">Booting Kernel...</div>;
    }

    // 3. GENESIS STATE (Unlocked) -> Force User to Onboarding
    if (!isLocked) {
        return <OnboardingWizard />;
    }

    // 4. SOVEREIGN STATE (Locked) -> Show OS
    return (
        <div className="flex h-screen bg-slate-50 text-slate-900">
            <Sidebar
                currentView={currentView}
                onChangeView={setCurrentView}
                activeCartridge={{ name: 'RETAIL', id: 'RETAIL' } as any} // Default Context
                onOpenAuctobot={() => { }}
                onOpenSettings={() => { }}
                onLoadDemo={() => { }}
                onResetData={() => { }}
                isDemoMode={false}
            />
            <main className="flex-1 overflow-auto">
                {currentView === 'command-center' && <CommandCenter />}
                {currentView === 'debate' && <DebateConsole />}
                {currentView === 'intelligence' && <IntelligenceView />}
                {currentView === 'data' && <DataPlaneView cartridge={null} />}
                {currentView === 'governance' && <GovernanceView logs={[]} skus={[]} activeSOPs={[]} />}
                {currentView === 'learning' && <LearningLoopView events={[]} revenueData={[]} championAccuracy={0} totalValue={0} />}
                {(currentView === 'price-optimizer' || currentView === 'markdown-manager') && <DecisionWorkbench contextTitle={currentView === 'price-optimizer' ? "Pricing" : "Markdown"} endpoint={`/orchestration/${currentView === 'price-optimizer' ? 'price_optimize' : 'markdown'}`} />}
            </main>
        </div>
    );
};

export default App;
