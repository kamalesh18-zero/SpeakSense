import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { SpeechPracticePage } from './pages/SpeechPracticePage';
import { BenchmarkResultsPage } from './pages/BenchmarkResultsPage';
import { BenchmarkProfilesPage } from './pages/BenchmarkProfilesPage';
import { AnalyzeSpeechPage } from './pages/AnalyzeSpeechPage';
import { ComparisonPage } from './pages/ComparisonPage';
import { TemporalAnalysisPage } from './pages/TemporalAnalysisPage';
import { ContrastiveDatasetPage } from './pages/ContrastiveDatasetPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuthPage } from './pages/AuthPage';
import { UserProfilePage } from './pages/UserProfilePage';
import {
  ContrastiveAnalysisResult,
  BenchmarkAnalysisResult,
  User,
} from './types';
import { fetchCurrentUser, logoutUser, fetchAnalysisById } from './services/api';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('practice');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Results
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkAnalysisResult | null>(null);
  const [contrastiveAnalysis, setContrastiveAnalysis] = useState<ContrastiveAnalysisResult | null>(null);

  // Quick launch params for contrastive speech
  const [quickLaunchScript, setQuickLaunchScript] = useState<string | undefined>(undefined);
  const [quickLaunchDelivery, setQuickLaunchDelivery] = useState<string | undefined>(undefined);

  // Check current user session on load
  useEffect(() => {
    fetchCurrentUser()
      .then((u) => setCurrentUser(u))
      .catch(() => setCurrentUser(null));
  }, []);

  const handleBenchmarkComplete = (result: BenchmarkAnalysisResult) => {
    setBenchmarkResult(result);
    setActiveTab('benchmark_results');
  };

  const handleContrastiveComplete = (result: ContrastiveAnalysisResult) => {
    setContrastiveAnalysis(result);
    setActiveTab('comparison');
  };

  const handleQuickLaunchContrastive = (scriptId: string, deliveryType: string) => {
    setQuickLaunchScript(scriptId);
    setQuickLaunchDelivery(deliveryType);
    setActiveTab('contrastive');
  };

  const handleSelectHistoryAnalysis = async (analysisId: string) => {
    try {
      const data = await fetchAnalysisById(analysisId);
      if (data.category_key || data.measurements) {
        // Benchmark result
        setBenchmarkResult(data as BenchmarkAnalysisResult);
        setActiveTab('benchmark_results');
      } else {
        // Contrastive result
        setContrastiveAnalysis(data as ContrastiveAnalysisResult);
        setActiveTab('comparison');
      }
    } catch (err) {
      console.error('Failed to load past analysis:', err);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    setActiveTab('practice');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onOpenAuth={() => setActiveTab('auth')}
        hasBenchmarkResult={Boolean(benchmarkResult)}
      />

      <main className="flex-1 pb-16">
        {activeTab === 'dashboard' && (
          <DashboardPage
            onNavigate={(tab) => setActiveTab(tab)}
            onQuickLaunch={handleQuickLaunchContrastive}
          />
        )}

        {activeTab === 'practice' && (
          <SpeechPracticePage
            onAnalysisComplete={handleBenchmarkComplete}
            onNavigateToContrastive={() => setActiveTab('contrastive')}
          />
        )}

        {activeTab === 'benchmark_results' && benchmarkResult && (
          <BenchmarkResultsPage
            result={benchmarkResult}
            onPracticeAgain={() => setActiveTab('practice')}
          />
        )}

        {activeTab === 'benchmarks' && <BenchmarkProfilesPage />}

        {activeTab === 'contrastive' && (
          <AnalyzeSpeechPage
            onAnalysisComplete={handleContrastiveComplete}
            initialScriptId={quickLaunchScript}
            initialDeliveryType={quickLaunchDelivery}
          />
        )}

        {activeTab === 'comparison' && (
          <ComparisonPage
            analysis={contrastiveAnalysis}
            onNavigateToFlaws={() => setActiveTab('flaws')}
          />
        )}

        {activeTab === 'flaws' && (
          <TemporalAnalysisPage
            analysis={contrastiveAnalysis}
            onNavigateToReport={() => setActiveTab('comparison')}
          />
        )}

        {activeTab === 'dataset' && <ContrastiveDatasetPage />}

        {activeTab === 'settings' && <SettingsPage />}

        {activeTab === 'auth' && (
          <AuthPage
            onAuthSuccess={(u) => {
              setCurrentUser(u);
              setActiveTab('practice');
            }}
            onCancel={() => setActiveTab('practice')}
          />
        )}

        {activeTab === 'profile' && currentUser && (
          <UserProfilePage
            user={currentUser}
            onUpdateUser={(updated) => setCurrentUser(updated)}
            onSelectAnalysis={handleSelectHistoryAnalysis}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Grandparent-Friendly Accessible Light Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">SpeakSense AI</span>
            <span>&bull;</span>
            <span>Speech Analytics, Temporal Flaw Finding & AI Coaching</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Deterministic Signal Processing &bull; Faster-Whisper CPU-int8 &bull; Three.js 3D Assistant
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
