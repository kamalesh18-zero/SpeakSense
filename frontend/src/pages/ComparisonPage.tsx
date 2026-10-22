import React, { useState } from 'react';
import {
  GitCompare,
  ArrowRight,
  Clock,
  Activity,
  AlertTriangle,
  Play,
  Volume2,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { ContrastiveAnalysisResult } from '../types';
import { AudioPlayerWaveform } from '../components/AudioPlayerWaveform';

interface ComparisonPageProps {
  analysis: ContrastiveAnalysisResult | null;
  onNavigateToFlaws: () => void;
}

export const ComparisonPage: React.FC<ComparisonPageProps> = ({ analysis, onNavigateToFlaws }) => {
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);
  const [activeChartTab, setActiveChartTab] = useState<'pitch' | 'energy'>('pitch');
  const [playerSeekTime, setPlayerSeekTime] = useState<number | null>(null);

  if (!analysis) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center space-y-4">
        <GitCompare className="w-12 h-12 text-teal-600 mx-auto opacity-70" />
        <h3 className="text-xl font-extrabold text-slate-900">No Speech Analysis Loaded</h3>
        <p className="text-xs text-slate-600">
          Run an evaluation in the Speech Analysis Studio to counterpoint reference and participant speech.
        </p>
      </div>
    );
  }

  const { reference_features, participant_features, alignment, flaws, dtw_distance } = analysis;

  const partTimes = participant_features.pitch.frame_times;
  const partF0Norm = participant_features.pitch.f0_semitones_norm;
  const refF0Norm = reference_features.pitch.f0_semitones_norm;

  const partRms = participant_features.energy.rms_db;
  const refRms = reference_features.energy.rms_db;

  const chartData = partTimes.map((t, idx) => ({
    time: t,
    part_pitch: partF0Norm[idx] ?? null,
    ref_pitch: refF0Norm[idx] ?? null,
    part_energy: partRms[idx] ?? -40,
    ref_energy: refRms[idx] ?? -40,
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
              <GitCompare className="w-6 h-6 text-teal-600" />
              <span>Counterpointing Speech Comparison</span>
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 font-bold font-mono">
              DTW Distance: {dtw_distance}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Aligned word-level acoustic contrast. Natural voice pitch differences normalized via speaker-median semitones.
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateToFlaws}
          className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-soft-teal transition-all self-start sm:self-auto"
        >
          <span>View {flaws.length} Detected Flaws</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Synchronized Side-by-Side Audio Players */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AudioPlayerWaveform
          title="Ideal Reference Delivery"
          subtitle="Optimal tempo, cadence, and baseline vocal pitch"
          audioUrl={analysis.audio_url_reference}
          duration={reference_features.metadata.duration_sec}
          accentColor="cyan"
        />

        <AudioPlayerWaveform
          title="Participant Delivery"
          subtitle="Analyzed speech with temporal flaw markers"
          audioUrl={analysis.audio_url_participant}
          duration={participant_features.metadata.duration_sec}
          seekTime={playerSeekTime}
          accentColor="teal"
        />
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="white-card p-4">
          <p className="text-[11px] font-bold text-slate-500 uppercase">Duration Delta</p>
          <p className="text-xl font-black text-slate-900 mt-0.5">
            {participant_features.metadata.duration_sec}s{' '}
            <span className="text-xs font-normal text-slate-500">
              (vs {reference_features.metadata.duration_sec}s)
            </span>
          </p>
          <p className="text-[11px] font-bold text-teal-700 mt-1">
            {participant_features.metadata.duration_sec > reference_features.metadata.duration_sec ? '+' : ''}
            {(participant_features.metadata.duration_sec - reference_features.metadata.duration_sec).toFixed(1)}s
          </p>
        </div>

        <div className="white-card p-4">
          <p className="text-[11px] font-bold text-slate-500 uppercase">Speaking Pace</p>
          <p className="text-xl font-black text-slate-900 mt-0.5">
            {participant_features.overall_wpm} WPM{' '}
            <span className="text-xs font-normal text-slate-500">(vs {reference_features.overall_wpm})</span>
          </p>
          <p className="text-[11px] font-bold text-sky-700 mt-1">
            {participant_features.overall_wpm > reference_features.overall_wpm ? '+' : ''}
            {(participant_features.overall_wpm - reference_features.overall_wpm).toFixed(1)} WPM
          </p>
        </div>

        <div className="white-card p-4">
          <p className="text-[11px] font-bold text-slate-500 uppercase">Pitch Variability</p>
          <p className="text-xl font-black text-slate-900 mt-0.5">
            {participant_features.pitch.semitone_std} st{' '}
            <span className="text-xs font-normal text-slate-500">(vs {reference_features.pitch.semitone_std} st)</span>
          </p>
          <p className="text-[11px] font-bold text-amber-700 mt-1">
            {participant_features.pitch.semitone_std < 1.6 ? 'Flat / Monotone' : 'Natural Modulation'}
          </p>
        </div>

        <div className="white-card p-4">
          <p className="text-[11px] font-bold text-slate-500 uppercase">Pause Count</p>
          <p className="text-xl font-black text-slate-900 mt-0.5">
            {participant_features.pauses.length}{' '}
            <span className="text-xs font-normal text-slate-500">(vs {reference_features.pauses.length})</span>
          </p>
          <p className="text-[11px] font-bold text-rose-700 mt-1">
            {participant_features.pauses.filter((p) => p.is_excessive).length} flagged pauses
          </p>
        </div>
      </div>

      {/* Interactive Signal Overlay Charts */}
      <div className="white-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
              <Activity className="w-4 h-4 text-teal-600" />
              <span>Acoustic Signal Overlays</span>
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Continuous frame-level measurements extracted via STFT & pYIN.
            </p>
          </div>

          <div className="flex rounded-xl bg-slate-100 p-0.5 border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveChartTab('pitch')}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                activeChartTab === 'pitch' ? 'bg-white text-teal-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pitch / F0 (Semitones)
            </button>
            <button
              type="button"
              onClick={() => setActiveChartTab('energy')}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                activeChartTab === 'energy' ? 'bg-white text-teal-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              RMS Energy (dB)
            </button>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis
                dataKey="time"
                stroke="#64748B"
                fontSize={10}
                tickFormatter={(val) => `${val.toFixed(1)}s`}
              />
              <YAxis
                stroke="#64748B"
                fontSize={10}
                domain={activeChartTab === 'pitch' ? [-8, 8] : [-45, 0]}
                unit={activeChartTab === 'pitch' ? ' st' : ' dB'}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                labelStyle={{ color: '#0F172A', fontWeight: 'bold', fontSize: '11px' }}
                formatter={(val: any, name: any) => [
                  `${Number(val).toFixed(2)} ${activeChartTab === 'pitch' ? 'st' : 'dB'}`,
                  String(name || '').includes('part') ? 'Participant' : 'Ideal Reference',
                ]}
              />
              <Legend
                formatter={(val) =>
                  val.includes('part') ? (
                    <span className="text-teal-700 font-bold text-xs">Participant</span>
                  ) : (
                    <span className="text-sky-700 font-bold text-xs">Ideal Reference</span>
                  )
                }
              />
              {activeChartTab === 'pitch' ? (
                <>
                  <Line
                    type="monotone"
                    dataKey="ref_pitch"
                    name="ref_pitch"
                    stroke="#0284C7"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="part_pitch"
                    name="part_pitch"
                    stroke="#0D9488"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    connectNulls
                  />
                </>
              ) : (
                <>
                  <Line
                    type="monotone"
                    dataKey="ref_energy"
                    name="ref_energy"
                    stroke="#0284C7"
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="part_energy"
                    name="part_energy"
                    stroke="#D97706"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Aligned Words & Relative Stretch Ledger */}
      <div className="white-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-teal-600" />
            <span>Aligned Word Timestamps & Temporal Stretch</span>
          </h3>
          <span className="text-xs text-teal-800 font-bold font-mono bg-teal-50 px-2 py-0.5 rounded">
            {alignment.aligned_words.length} words aligned
          </span>
        </div>

        <div className="overflow-x-auto max-h-72 overflow-y-auto pr-1">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-700 text-[11px] font-bold">
              <tr>
                <th className="py-2.5 px-3">Spoken Word</th>
                <th className="py-2.5 px-3">Ref Timestamps</th>
                <th className="py-2.5 px-3">Part Timestamps</th>
                <th className="py-2.5 px-3">Relative Stretch</th>
                <th className="py-2.5 px-3">Local WPM</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {alignment.aligned_words.map((w, idx) => {
                const refW = reference_features.words[idx];
                const stretch = w.relative_stretch || 1.0;
                const isRushed = stretch < 0.75;
                const isDragged = stretch > 1.35;

                return (
                  <tr
                    key={idx}
                    className={`hover:bg-slate-50 transition-colors ${
                      selectedWordIndex === idx ? 'bg-teal-50/80 font-bold' : ''
                    }`}
                  >
                    <td className="py-2 px-3 font-sans font-bold text-slate-900">{w.word}</td>
                    <td className="py-2 px-3 text-slate-500">
                      {refW ? `${refW.start.toFixed(2)}s - ${refW.end.toFixed(2)}s` : '--'}
                    </td>
                    <td className="py-2 px-3 text-slate-800 font-semibold">
                      {w.start.toFixed(2)}s - {w.end.toFixed(2)}s
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isRushed
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : isDragged
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {stretch.toFixed(2)}x {isRushed ? '(Fast)' : isDragged ? '(Slow)' : ''}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-800">{w.local_wpm ? `${w.local_wpm} WPM` : '--'}</td>
                    <td className="py-2 px-3 text-right font-sans">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedWordIndex(idx);
                          setPlayerSeekTime(w.start);
                        }}
                        className="text-teal-700 hover:text-teal-900 font-bold hover:underline"
                      >
                        Seek
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
