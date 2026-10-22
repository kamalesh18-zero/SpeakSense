import React, { useState } from 'react';
import {
  Clock,
  AlertTriangle,
  Play,
  CheckCircle2,
  Info,
  ArrowRight,
  Sparkles,
  HelpCircle,
  TrendingDown,
  Volume2,
} from 'lucide-react';
import { ContrastiveAnalysisResult, FlawEvidence } from '../types';
import { AudioPlayerWaveform } from '../components/AudioPlayerWaveform';

interface TemporalAnalysisPageProps {
  analysis: ContrastiveAnalysisResult | null;
  onNavigateToReport: () => void;
}

export const TemporalAnalysisPage: React.FC<TemporalAnalysisPageProps> = ({
  analysis,
  onNavigateToReport,
}) => {
  const [selectedFlawId, setSelectedFlawId] = useState<string | null>(null);
  const [playerSeekTime, setPlayerSeekTime] = useState<number | null>(null);
  const [activeFlawFilter, setActiveFlawFilter] = useState<string>('all');

  if (!analysis) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center space-y-4">
        <Clock className="w-12 h-12 text-teal-600 mx-auto opacity-70" />
        <h3 className="text-xl font-extrabold text-slate-900">No Analysis Available</h3>
        <p className="text-xs text-slate-600">
          Run a speech evaluation to view detected localized delivery flaws.
        </p>
      </div>
    );
  }

  const { flaws, participant_features, reference_features } = analysis;
  const duration = participant_features.metadata.duration_sec || 30.0;

  const filteredFlaws = flaws.filter((f) => {
    if (activeFlawFilter === 'all') return true;
    if (activeFlawFilter === 'speed') return f.flaw_type.includes('speed') || f.flaw_type.includes('slow');
    if (activeFlawFilter === 'pause') return f.flaw_type.includes('pause');
    if (activeFlawFilter === 'pitch') return f.flaw_type.includes('pitch');
    if (activeFlawFilter === 'energy') return f.flaw_type.includes('energy');
    return true;
  });

  const selectedFlaw = flaws.find((f) => f.flaw_id === selectedFlawId) || filteredFlaws[0] || null;

  const handleSelectFlaw = (flaw: FlawEvidence) => {
    setSelectedFlawId(flaw.flaw_id);
    setPlayerSeekTime(flaw.start_time);
  };

  const getSeverityBadge = (sev: number) => {
    switch (sev) {
      case 3:
        return { label: 'Severe (Level 3)', bg: 'bg-rose-50 text-rose-800 border-rose-300' };
      case 2:
        return { label: 'Moderate (Level 2)', bg: 'bg-amber-50 text-amber-800 border-amber-300' };
      default:
        return { label: 'Mild (Level 1)', bg: 'bg-teal-50 text-teal-800 border-teal-300' };
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <Clock className="w-6 h-6 text-teal-600" />
            <span>Temporal Flaw Analysis</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Grounded in measurable signal deviations. Click any flaw card or timeline marker to seek audio playback directly to that timestamp.
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateToReport}
          className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-soft-teal transition-all self-start sm:self-auto"
        >
          <span>View Performance Report</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Synchronized Audio Player with Highlight Interval */}
      <AudioPlayerWaveform
        title="Participant Audio Player (Synced to Flaw Timestamps)"
        subtitle="Waveform will seek immediately when a flaw card is clicked below"
        audioUrl={analysis.audio_url_participant}
        duration={duration}
        seekTime={playerSeekTime}
        highlightInterval={
          selectedFlaw ? { start: selectedFlaw.start_time, end: selectedFlaw.end_time } : null
        }
        accentColor="cyan"
      />

      {/* Visual Timeline of Flaw Intervals */}
      <div className="white-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-slate-900 tracking-wide">
            Delivery Timeline & Localized Flaw Bands (0.0s – {duration.toFixed(1)}s)
          </span>
          <span className="text-[11px] text-teal-800 font-bold font-mono bg-teal-50 px-2 py-0.5 rounded">
            {flaws.length} detected flaws
          </span>
        </div>

        <div className="relative w-full h-10 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden flex items-center">
          {Array.from({ length: Math.ceil(duration / 5) }).map((_, i) => (
            <div
              key={i}
              className="absolute h-full border-r border-slate-300 text-[9px] text-slate-400 pl-1 pt-0.5 font-mono select-none"
              style={{ left: `${((i * 5) / duration) * 100}%` }}
            >
              {i * 5}s
            </div>
          ))}

          {/* Render Flaw Interval Bands */}
          {flaws.map((flaw) => {
            const leftPct = Math.max(0, Math.min(100, (flaw.start_time / duration) * 100));
            const widthPct = Math.max(1.5, Math.min(100 - leftPct, ((flaw.end_time - flaw.start_time) / duration) * 100));
            const isSelected = selectedFlaw?.flaw_id === flaw.flaw_id;

            return (
              <div
                key={flaw.flaw_id}
                onClick={() => handleSelectFlaw(flaw)}
                title={`${flaw.flaw_type} (${flaw.start_time.toFixed(1)}s - ${flaw.end_time.toFixed(1)}s)`}
                className={`absolute h-7 rounded-md cursor-pointer transition-all flex items-center justify-center ${
                  isSelected ? 'ring-2 ring-teal-500 z-20' : 'opacity-85 hover:opacity-100 z-10'
                } ${
                  flaw.severity === 3
                    ? 'bg-rose-500 text-white'
                    : flaw.severity === 2
                    ? 'bg-amber-500 text-white'
                    : 'bg-teal-500 text-white'
                }`}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              >
                <span className="text-[9px] font-bold px-1 truncate">{flaw.flaw_type.split('_')[0]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Flaw Detail & List Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Flaw List with Category Filters */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
            {[
              { id: 'all', label: `All (${flaws.length})` },
              { id: 'speed', label: 'Speed' },
              { id: 'pause', label: 'Pauses' },
              { id: 'pitch', label: 'Pitch' },
              { id: 'energy', label: 'Energy' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFlawFilter(tab.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  activeFlawFilter === tab.id
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
            {filteredFlaws.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-300 rounded-xl text-slate-500 text-xs">
                No flaws found in this category.
              </div>
            ) : (
              filteredFlaws.map((flaw) => {
                const isSelected = selectedFlaw?.flaw_id === flaw.flaw_id;
                const badge = getSeverityBadge(flaw.severity);

                return (
                  <div
                    key={flaw.flaw_id}
                    onClick={() => handleSelectFlaw(flaw)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-teal-50/70 border-teal-500 ring-2 ring-teal-500/20 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-extrabold text-slate-900 capitalize">
                        {flaw.flaw_type.replace(/_/g, ' ')}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${badge.bg}`}>
                        {badge.label}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-mono">
                      <span>{flaw.start_time.toFixed(2)}s – {flaw.end_time.toFixed(2)}s</span>
                      <span>•</span>
                      <span className="text-teal-700 font-bold">
                        {flaw.relative_difference_pct > 0 ? '+' : ''}
                        {flaw.relative_difference_pct.toFixed(1)}% vs ref
                      </span>
                    </div>

                    {flaw.word_context && (
                      <p className="text-[11px] text-slate-700 mt-2 font-serif italic line-clamp-1">
                        "{flaw.word_context}"
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Deep Mathematical Evidence & Actionable Suggestion */}
        <div className="lg:col-span-7">
          {selectedFlaw ? (
            <div className="white-card p-6 space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg font-black text-slate-900 capitalize">
                      {selectedFlaw.flaw_type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold font-mono">
                      {selectedFlaw.reliability_status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Timestamp: {selectedFlaw.start_time.toFixed(2)}s – {selectedFlaw.end_time.toFixed(2)}s (Duration: {(selectedFlaw.end_time - selectedFlaw.start_time).toFixed(2)}s)
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setPlayerSeekTime(selectedFlaw.start_time)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-soft-teal"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play Clip</span>
                </button>
              </div>

              {/* Word Context Card */}
              {selectedFlaw.word_context && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Spoken Phrase Context:
                  </p>
                  <p className="text-sm font-serif italic text-teal-900">
                    "{selectedFlaw.word_context}"
                  </p>
                </div>
              )}

              {/* Mathematical Measurement Comparison Grid */}
              <div>
                <p className="text-xs font-bold text-slate-900 mb-2 flex items-center space-x-1.5">
                  <Info className="w-3.5 h-3.5 text-teal-600" />
                  <span>Mathematical Evidence & Measurements</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Participant</p>
                    <p className="text-sm font-black text-slate-900 mt-0.5">
                      {selectedFlaw.participant_value} {selectedFlaw.measurement_unit}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Ideal Reference</p>
                    <p className="text-sm font-black text-slate-900 mt-0.5">
                      {selectedFlaw.reference_value} {selectedFlaw.measurement_unit}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Relative Deviation</p>
                    <p className="text-sm font-black text-teal-700 mt-0.5">
                      {selectedFlaw.relative_difference_pct > 0 ? '+' : ''}
                      {selectedFlaw.relative_difference_pct.toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Severity Level</p>
                    <p className="text-sm font-black text-rose-700 mt-0.5">
                      Level {selectedFlaw.severity}
                    </p>
                  </div>
                </div>
              </div>

              {/* Mathematical Explanation */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                  Acoustic Root-Cause Analysis:
                </span>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {selectedFlaw.explanation}
                </p>
              </div>

              {/* Actionable Vocal Rectification Suggestion */}
              <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 space-y-1">
                <div className="flex items-center space-x-1.5 text-teal-900 text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  <span>Actionable Delivery Rectification:</span>
                </div>
                <p className="text-xs text-teal-900 leading-relaxed">
                  {selectedFlaw.improvement_suggestion}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center border border-dashed border-slate-300 rounded-2xl text-slate-500 text-xs">
              Select a flaw from the left list to inspect detailed acoustic evidence.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
