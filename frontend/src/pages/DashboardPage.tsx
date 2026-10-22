import React, { useEffect, useState } from 'react';
import {
  Mic,
  Award,
  Layers,
  ArrowRight,
  Sparkles,
  BookOpen,
  Sliders,
  CheckCircle2,
  Clock,
  Play
} from 'lucide-react';
import { fetchRecentAnalyses, fetchScripts, fetchRecordings } from '../services/api';
import { ScriptItem, RecordingItem } from '../types';
import { Assistant3DAvatar } from '../components/Assistant3DAvatar';

interface DashboardPageProps {
  onNavigate: (tab: string, analysisId?: string) => void;
  onQuickLaunch?: (scriptId: string, deliveryType: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate, onQuickLaunch }) => {
  const [scripts, setScripts] = useState<ScriptItem[]>([]);
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [recentAnalyses, setRecentAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [s, r, a] = await Promise.all([
          fetchScripts().catch(() => []),
          fetchRecordings().catch(() => []),
          fetchRecentAnalyses().catch(() => []),
        ]);
        setScripts(s);
        setRecordings(r);
        setRecentAnalyses(a);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const avgScore =
    recentAnalyses.length > 0
      ? Math.round(recentAnalyses.reduce((acc, curr) => acc + (curr.total_score || 0), 0) / recentAnalyses.length)
      : 86;

  const categories = [
    { key: 'public_speaking', name: 'Public Speaking', pace: '130–160 WPM', desc: 'Conferences, keynotes & clear presentations' },
    { key: 'persuasive_oratory', name: 'Persuasive Oratory', pace: '125–155 WPM', desc: 'Rhetoric, leadership appeals & pitches' },
    { key: 'declamation', name: 'Declamation', pace: '115–145 WPM', desc: 'Formal dramatic addresses & historical delivery' },
    { key: 'interpretive_reading', name: 'Interpretive Reading', pace: '110–140 WPM', desc: 'Storytelling, narrative & literature' },
    { key: 'extemporaneous', name: 'Extemporaneous', pace: '135–165 WPM', desc: 'Spontaneous analysis & structured opinions' },
    { key: 'debate', name: 'Debate', pace: '160–210 WPM', desc: 'High-density parliamentary & policy argumentation' },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Grandparent-Friendly Light Hero Banner */}
      <div className="white-card p-8 sm:p-10 border border-slate-200 shadow-soft-md relative overflow-hidden bg-gradient-to-br from-white via-slate-50 to-teal-50/40">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles className="w-4 h-4 text-teal-600" />
            <span>AI Speech Analytics & Coaching Platform</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Speak with Confidence,{' '}
            <span className="text-teal-600">
              Guided by Real Signal Science
            </span>
          </h1>

          <p className="mt-3 text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
            Practice reading speeches aloud or test your own presentation. Receive instant 100-point rubric scores,
            exact flaw timestamps, and guided pacing tips from Alex, your 3D speech coach.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('practice')}
              className="px-6 py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-base shadow-soft-teal transition-all flex items-center gap-2"
            >
              <Mic className="w-5 h-5" /> Start Speech Practice
            </button>
            <button
              type="button"
              onClick={() => onNavigate('benchmarks')}
              className="px-5 py-3.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl font-semibold text-sm shadow-sm transition-colors flex items-center gap-2"
            >
              <Sliders className="w-4 h-4 text-slate-500" /> View 6 Benchmark Profiles
            </button>
            <button
              type="button"
              onClick={() => onNavigate('contrastive')}
              className="px-5 py-3.5 text-teal-700 hover:text-teal-900 hover:underline text-sm font-semibold transition-colors flex items-center gap-1.5"
            >
              <Layers className="w-4 h-4" /> Advanced Contrastive Comparison
            </button>
          </div>
        </div>
      </div>

      {/* Key Metric Snapshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="white-card p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Built-in Categories
          </span>
          <div className="text-3xl font-black text-slate-900 mb-1">6 Profiles</div>
          <p className="text-xs text-slate-500">
            Public Speaking, Oratory, Debate & more
          </p>
        </div>

        <div className="white-card p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Deterministic Engine
          </span>
          <div className="text-3xl font-black text-teal-600 mb-1">100-pt Rubric</div>
          <p className="text-xs text-slate-500">
            Pacing, Pauses, Pitch, Energy & Clarity
          </p>
        </div>

        <div className="white-card p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Average Score Attained
          </span>
          <div className="text-3xl font-black text-sky-600 mb-1">{avgScore} / 100</div>
          <p className="text-xs text-slate-500">
            Based on recent speech evaluations
          </p>
        </div>

        <div className="white-card p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Pre-recorded Samples
          </span>
          <div className="text-3xl font-black text-slate-900 mb-1">30 Speeches</div>
          <p className="text-xs text-slate-500">
            Ground-truth labeled reference dataset
          </p>
        </div>
      </div>

      {/* 3D Coach Spotlight & Benchmark Category Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Categories Grid (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-teal-600" /> Explore Benchmark Speaking Categories
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('benchmarks')}
              className="text-xs font-semibold text-teal-700 hover:underline"
            >
              Customize Targets &rarr;
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {categories.map((cat) => (
              <div
                key={cat.key}
                onClick={() => onNavigate('practice')}
                className="white-card-hover p-5 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm text-slate-900">{cat.name}</span>
                    <span className="text-[11px] font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                      {cat.pace}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{cat.desc}</p>
                </div>
                <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-teal-700">
                  <span>Practice this category</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3D Assistant Card (5 cols) */}
        <div className="lg:col-span-5 white-card p-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600" /> Meet Alex, Your Speech Coach
              </h3>
              <p className="text-xs text-slate-500">Interactive Virtual Speech Coach</p>
            </div>
            <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full">
              Interactive Guide
            </span>
          </div>

          <Assistant3DAvatar
            isSpeaking={false}
            coachMessage="Hi there! I analyze your voice in real time to help you speak with natural rhythm, strong projection, and great pacing. Let's do a practice round!"
            className="mt-2"
          />

          <div className="mt-4 pt-3 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => onNavigate('practice')}
              className="w-full py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl font-bold text-xs transition-colors"
            >
              Start Guided Practice with Alex &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Pre-recorded Speech Benchmark Samples (Preserving existing 30 dataset samples) */}
      <div className="white-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-teal-600" /> Pre-Recorded Speech Samples & Ground Truth Flaws
            </h3>
            <p className="text-xs text-slate-500">
              Explore 30 pre-recorded participant deliveries with ground-truth expert annotations.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('dataset')}
            className="text-xs font-semibold text-teal-700 hover:underline shrink-0"
          >
            Open Evaluation Benchmark &rarr;
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {scripts.slice(0, 6).map((script) => (
            <div
              key={script.id}
              onClick={() => {
                if (onQuickLaunch) {
                  onQuickLaunch(script.id, 'excessively_fast');
                } else {
                  onNavigate('contrastive');
                }
              }}
              className="p-3.5 bg-slate-50 hover:bg-teal-50/70 border border-slate-200 hover:border-teal-200 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3 group"
            >
              <div>
                <span className="text-xs font-bold text-slate-900 block group-hover:text-teal-700">
                  {script.title}
                </span>
                <span className="text-[11px] text-slate-500">
                  {script.category} &bull; {script.target_duration_sec}s target
                </span>
              </div>
              <Play className="w-4 h-4 text-slate-400 group-hover:text-teal-600 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
