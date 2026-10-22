import React from 'react';
import {
  Mic2,
  GitCompare,
  Database,
  Sliders,
  Settings,
  Sparkles,
  User as UserIcon,
  Award,
  BookOpen
} from 'lucide-react';
import { User } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  systemStatus?: string;
  currentUser: User | null;
  onOpenAuth: () => void;
  hasBenchmarkResult?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  systemStatus = 'Operational',
  currentUser,
  onOpenAuth,
  hasBenchmarkResult = false,
}) => {
  const navItems = [
    { id: 'practice', label: 'Speech Practice', icon: Mic2 },
    ...(hasBenchmarkResult ? [{ id: 'benchmark_results', label: 'Evaluation Report', icon: Award }] : []),
    { id: 'benchmarks', label: 'Benchmark Targets', icon: Sliders },
    { id: 'contrastive', label: 'Advanced Comparison', icon: GitCompare },
    { id: 'dataset', label: 'Ground Truth Dataset', icon: Database },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-soft-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Branding */}
          <div
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => setActiveTab('practice')}
          >
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center shadow-soft-teal group-hover:scale-105 transition-transform">
              <Mic2 className="w-5 h-5 text-white font-bold" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xl font-black tracking-tight text-slate-900">
                  SpeakSense
                </span>
                <span className="text-[11px] px-1.5 py-0.5 rounded font-mono font-bold bg-teal-50 text-teal-700 border border-teal-200">
                  AI
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block tracking-wide">
                Speech Analytics & Temporal Flaw Finding
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-teal-50 text-teal-700 border border-teal-200 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Area: System Status & User Profile */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-slate-500 font-mono text-[11px] hidden xl:inline">Whisper &bull; Signal DSP</span>
              <span className="text-slate-800 font-semibold text-[11px]">{systemStatus}</span>
            </div>

            {currentUser ? (
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={`flex items-center gap-2 p-1 pl-2.5 rounded-xl border transition-all ${
                  activeTab === 'profile'
                    ? 'bg-teal-50 border-teal-300 ring-2 ring-teal-500/20'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="text-xs font-bold text-slate-800 hidden sm:inline">
                  {currentUser.full_name.split(' ')[0]}
                </span>
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black"
                  style={{ backgroundColor: currentUser.avatar_color || '#14B8A6' }}
                >
                  {currentUser.full_name.charAt(0).toUpperCase()}
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
              >
                <UserIcon className="w-3.5 h-3.5" /> Sign In
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="lg:hidden flex overflow-x-auto px-3 py-2 bg-slate-50 border-t border-slate-200 space-x-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center space-x-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold ${
                isActive
                  ? 'bg-white text-teal-700 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
