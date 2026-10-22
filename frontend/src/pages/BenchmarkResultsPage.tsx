import React, { useState, useRef } from 'react';
import {
  Download,
  RotateCcw,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Clock,
  Activity,
  Mic,
  Zap,
  Volume2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BarChart3
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  ReferenceLine,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { BenchmarkAnalysisResult, FlawEvidence, WordTimestamp } from '../types';
import { generateBenchmarkPdfReport } from '../services/pdfGenerator';
import { Assistant3DAvatar } from '../components/Assistant3DAvatar';
import { diagnoseFlawsAI, FlawDoctorDiagnosis } from '../services/api';

interface BenchmarkResultsPageProps {
  result: BenchmarkAnalysisResult;
  onPracticeAgain: () => void;
}

export const BenchmarkResultsPage: React.FC<BenchmarkResultsPageProps> = ({
  result,
  onPracticeAgain,
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showAdvancedMetrics, setShowAdvancedMetrics] = useState(false);
  const [selectedFlaw, setSelectedFlaw] = useState<FlawEvidence | null>(null);

  // Gemini AI Flaw Doctor Diagnostic
  const [doctorDiagnosis, setDoctorDiagnosis] = useState<FlawDoctorDiagnosis | null>(null);
  const [isLoadingDoctor, setIsLoadingDoctor] = useState(false);
  const [doctorError, setDoctorError] = useState<string | null>(null);

  const handleConsultDoctor = async () => {
    setIsLoadingDoctor(true);
    setDoctorError(null);
    try {
      const diag = await diagnoseFlawsAI(result.measurements);
      setDoctorDiagnosis(diag);
    } catch (err: any) {
      setDoctorError(err.message || 'Failed to fetch diagnostic.');
    } finally {
      setIsLoadingDoctor(false);
    }
  };

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const totalScore = Math.round(result.score.total_score);

  const getScoreVerdict = (score: number) => {
    if (score >= 90) return { label: 'Outstanding Delivery!', color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' };
    if (score >= 80) return { label: 'Great Job! Clear & Natural', color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200' };
    if (score >= 70) return { label: 'Good Speech, A Few Adjustments Needed', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
    return { label: 'Needs Practice & Pacing Control', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' };
  };

  const verdict = getScoreVerdict(totalScore);

  // Audio control
  const togglePlayAudio = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const seekToTime = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      if (!isPlayingAudio) {
        audioRef.current.play();
        setIsPlayingAudio(true);
      }
    }
  };

  // Radar Data for 5 Categories
  const radarData = result.score.categories.map((cat) => ({
    category: cat.name.split(' ')[0],
    score: Math.round((cat.score / cat.max_score) * 100),
    fullMark: 100,
  }));

  // Timeline downsampled for charts (every 2nd point for smoothness)
  const chartTimeline = result.timeline
    .filter((_, idx) => idx % 2 === 0)
    .map((pt) => ({
      time: Number(pt.time.toFixed(1)),
      f0_semitones: pt.f0_semitones !== null ? Number(pt.f0_semitones.toFixed(2)) : null,
      rms_db: Number(pt.rms_db.toFixed(1)),
    }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        src={result.audio_url}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onEnded={() => setIsPlayingAudio(false)}
      />

      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <span className="text-xs font-semibold text-teal-700 uppercase tracking-wider">
            Evaluation Report &bull; {result.category_name}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Your Speech Analysis & Scores
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Analyzed {result.words.length} words over {result.audio_duration_sec.toFixed(1)} seconds against {result.category_name} standards.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={onPracticeAgain}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" /> Practice Again
          </button>
          <button
            type="button"
            onClick={() => generateBenchmarkPdfReport(result)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold shadow-soft-teal transition-all"
          >
            <Download className="w-4 h-4" /> Download 4-Page PDF
          </button>
        </div>
      </div>

      {/* Main Score & Audio Replay Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Score & Verdict Card (7 cols) */}
        <div className="lg:col-span-7 white-card p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Overall Speech Score
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${verdict.bg} ${verdict.color} ${verdict.border}`}>
                {verdict.label}
              </span>
            </div>

            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-6xl sm:text-7xl font-extrabold tracking-tight text-slate-900">
                {totalScore}
              </span>
              <span className="text-2xl font-semibold text-slate-400">/ 100</span>
            </div>

            {/* Quick Strengths & Priority Guidance */}
            <div className="space-y-3 mb-6">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
                  Primary Delivery Advice
                </span>
                <p className="text-sm text-slate-800 leading-relaxed font-normal">
                  {result.plain_language_advice[0] || 'Keep practicing regular pacing and breathing pauses at punctuation.'}
                </p>
              </div>
            </div>
          </div>

          {/* Audio Player & Seeking Bar */}
          <div className="p-4 bg-teal-50/70 rounded-2xl border border-teal-200">
            <div className="flex items-center gap-3 mb-2">
              <button
                type="button"
                onClick={togglePlayAudio}
                className="w-11 h-11 flex items-center justify-center bg-teal-600 hover:bg-teal-700 text-white rounded-full shrink-0 shadow-soft-teal transition-all"
              >
                {isPlayingAudio ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </button>

              <div className="flex-1">
                <div className="flex items-center justify-between text-xs font-bold text-teal-950 mb-1">
                  <span>Replay Recording & Click Words to Seek</span>
                  <span>
                    {currentTime.toFixed(1)}s / {result.audio_duration_sec.toFixed(1)}s
                  </span>
                </div>

                {/* Seekable Track */}
                <input
                  type="range"
                  min="0"
                  max={result.audio_duration_sec || 1}
                  step="0.05"
                  value={currentTime}
                  onChange={(e) => seekToTime(parseFloat(e.target.value))}
                  className="w-full accent-teal-600 cursor-pointer h-2 bg-teal-200 rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3D Coach Reaction (5 cols) */}
        <div className="lg:col-span-5 white-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600" /> Alex's Feedback
              </h3>
              <span className="text-xs font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                Interactive Assistant
              </span>
            </div>

            <Assistant3DAvatar
              isSpeaking={isPlayingAudio}
              coachMessage={
                totalScore >= 80
                  ? `Tremendous job! You scored ${totalScore}/100. Your pacing and voice modulation are well suited for ${result.category_name}!`
                  : `You achieved ${totalScore}/100. Let's work on smoothing out mid-sentence pauses and keeping your pacing steady!`
              }
              className="mt-1"
            />
          </div>
        </div>
      </div>

      {/* 5 Category Score Cards (Grandparent-Friendly Large Cards) */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-teal-600" /> Five Core Speech Metrics
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Pacing */}
          <div className="white-card p-5 border-l-4 border-l-teal-500 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
                <span>Pacing & Speed</span>
                <span>{result.score.categories[0]?.score.toFixed(0)} / {result.score.categories[0]?.max_score}</span>
              </div>
              <div className="text-2xl font-black text-slate-900 mb-1">
                {result.measurements.effective_wpm.toFixed(0)} <span className="text-xs font-medium text-slate-500">WPM</span>
              </div>
              <p className="text-xs text-slate-600 leading-snug">
                Target: {result.target_summary.wpm_range[0]}–{result.target_summary.wpm_range[1]} WPM
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] font-medium text-teal-700">
              {result.measurements.effective_wpm < result.target_summary.wpm_range[0]
                ? 'Slightly slow cadence'
                : result.measurements.effective_wpm > result.target_summary.wpm_range[1]
                ? 'Rushing past listeners'
                : 'Perfect speaking pace!'}
            </div>
          </div>

          {/* Card 2: Pauses */}
          <div className="white-card p-5 border-l-4 border-l-sky-500 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
                <span>Pauses & Breath</span>
                <span>{result.score.categories[1]?.score.toFixed(0)} / {result.score.categories[1]?.max_score}</span>
              </div>
              <div className="text-2xl font-black text-slate-900 mb-1">
                {result.measurements.mean_pause_sec.toFixed(2)} <span className="text-xs font-medium text-slate-500">sec avg</span>
              </div>
              <p className="text-xs text-slate-600 leading-snug">
                {result.measurements.pause_count} pauses ({result.measurements.excessive_pause_count} awkward)
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] font-medium text-sky-700">
              {result.measurements.excessive_pause_count === 0
                ? 'Zero excessive pauses!'
                : `${result.measurements.excessive_pause_count} hesitant pause(s)`}
            </div>
          </div>

          {/* Card 3: Pitch Variation */}
          <div className="white-card p-5 border-l-4 border-l-indigo-500 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
                <span>Vocal Pitch</span>
                <span>{result.score.categories[2]?.score.toFixed(0)} / {result.score.categories[2]?.max_score}</span>
              </div>
              <div className="text-2xl font-black text-slate-900 mb-1">
                {result.measurements.pitch_semitone_std.toFixed(2)} <span className="text-xs font-medium text-slate-500">st std</span>
              </div>
              <p className="text-xs text-slate-600 leading-snug">
                Speaker F0: {Math.round(result.measurements.median_f0_hz)} Hz
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] font-medium text-indigo-700">
              {result.measurements.pitch_semitone_std < 1.4 ? 'Sounds monotonous' : 'Lively expression'}
            </div>
          </div>

          {/* Card 4: Energy & Volume */}
          <div className="white-card p-5 border-l-4 border-l-amber-500 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
                <span>Energy & Projection</span>
                <span>{result.score.categories[3]?.score.toFixed(0)} / {result.score.categories[3]?.max_score}</span>
              </div>
              <div className="text-2xl font-black text-slate-900 mb-1">
                {result.measurements.dynamic_range_db.toFixed(1)} <span className="text-xs font-medium text-slate-500">dB range</span>
              </div>
              <p className="text-xs text-slate-600 leading-snug">
                Target: &ge; {result.target_summary.dyn_range_min_db} dB
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] font-medium text-amber-700">
              {result.measurements.dynamic_range_db >= 14 ? 'Good volume emphasis' : 'Low dynamic contrast'}
            </div>
          </div>

          {/* Card 5: Clarity */}
          <div className="white-card p-5 border-l-4 border-l-emerald-500 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
                <span>Speech Clarity</span>
                <span>{result.score.categories[4]?.score.toFixed(0)} / {result.score.categories[4]?.max_score}</span>
              </div>
              <div className="text-2xl font-black text-slate-900 mb-1">
                {Math.round(result.measurements.alignment_confidence * 100)}%
              </div>
              <p className="text-xs text-slate-600 leading-snug">
                Audio SNR: {result.measurements.snr_db.toFixed(1)} dB
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] font-medium text-emerald-700">
              Clean transcription signal
            </div>
          </div>
        </div>
      </div>

      {/* 5 Simple Visual Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Chart 1: Category Balance Radar */}
        <div className="white-card p-6">
          <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-teal-600" /> Rubric Category Balance
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Percentage attained across all 5 benchmark dimensions.
          </p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="category" stroke="#475569" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#cbd5e1" />
                <Radar
                  name="Attained Score"
                  dataKey="score"
                  stroke="#14b8a6"
                  fill="#14b8a6"
                  fillOpacity={0.45}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Pacing Progression Timeline */}
        <div className="white-card p-6">
          <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-600" /> Speaking Rate (WPM) Progression
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Green shaded band shows target {result.target_summary.wpm_range[0]}–{result.target_summary.wpm_range[1]} WPM.
          </p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.wpm_progression}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="window_center_sec" unit="s" stroke="#94a3b8" />
                <YAxis domain={[80, 240]} stroke="#94a3b8" />
                <Tooltip formatter={(val: any) => [`${val} WPM`, 'Pace']} />
                <ReferenceLine
                  y={result.target_summary.wpm_range[0]}
                  stroke="#14b8a6"
                  strokeDasharray="4 4"
                  label={{ value: 'Min WPM', fill: '#14b8a6', fontSize: 10 }}
                />
                <ReferenceLine
                  y={result.target_summary.wpm_range[1]}
                  stroke="#14b8a6"
                  strokeDasharray="4 4"
                  label={{ value: 'Max WPM', fill: '#14b8a6', fontSize: 10 }}
                />
                <Line
                  type="monotone"
                  dataKey="local_wpm"
                  stroke="#0284c7"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#0284c7' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Pitch Contour (Semitone Voice Modulation) */}
        <div className="white-card p-6">
          <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" /> Voice Pitch Contour (Semitones Normalized)
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Values centered at your natural median pitch (0.0 st). Flat lines indicate monotone.
          </p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" unit="s" stroke="#94a3b8" />
                <YAxis domain={[-8, 8]} stroke="#94a3b8" />
                <Tooltip formatter={(val: any) => [`${val} st`, 'Pitch Modulation']} />
                <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="2 2" />
                <Line
                  type="monotone"
                  dataKey="f0_semitones"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Volume & Projection Envelope */}
        <div className="white-card p-6">
          <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-amber-600" /> Loudness / Volume Envelope (RMS dB)
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Shows where you projected your voice strongly vs whispered.
          </p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" unit="s" stroke="#94a3b8" />
                <YAxis domain={[-60, -10]} stroke="#94a3b8" />
                <Tooltip formatter={(val: any) => [`${val} dB`, 'Loudness']} />
                <Line
                  type="monotone"
                  dataKey="rms_db"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Temporal Flaws Table with Click-to-Seek */}
      <div className="white-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Detected Delivery Flaws & Timestamps
            </h3>
            <p className="text-xs text-slate-500">
              Click on any flaw to jump directly to that timestamp in your recording!
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 rounded-lg text-slate-600">
            {result.flaws.length} Flaw(s) Identified
          </span>
        </div>

        {result.flaws.length === 0 ? (
          <div className="p-8 text-center bg-teal-50/50 rounded-xl border border-teal-100">
            <CheckCircle className="w-10 h-10 text-teal-600 mx-auto mb-2" />
            <h4 className="text-base font-bold text-teal-900 mb-1">No Delivery Flaws Found!</h4>
            <p className="text-sm text-teal-700">
              Your recording maintained solid pacing, natural pitch modulation, and clean pause boundaries.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {result.flaws.map((flaw, idx) => (
              <div
                key={flaw.flaw_id || idx}
                onClick={() => seekToTime(flaw.start_time)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  currentTime >= flaw.start_time && currentTime <= flaw.end_time
                    ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-400'
                    : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/80'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-sm text-slate-900">
                      {flaw.flaw_type.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-teal-50 hover:text-teal-700"
                    >
                      <Play className="w-3 h-3 fill-current" /> {flaw.start_time.toFixed(1)}s - {flaw.end_time.toFixed(1)}s
                    </button>
                  </div>

                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full self-start sm:self-auto ${
                      flaw.severity === 3
                        ? 'bg-rose-100 text-rose-800'
                        : flaw.severity === 2
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-sky-100 text-sky-800'
                    }`}
                  >
                    {flaw.severity === 3 ? 'High Deviation' : flaw.severity === 2 ? 'Moderate' : 'Mild'}
                  </span>
                </div>

                <p className="text-xs text-slate-700 ml-8 mb-1 leading-relaxed">
                  <strong>Acoustic Evidence:</strong> {flaw.explanation}
                </p>
                <p className="text-xs text-teal-700 ml-8 font-medium">
                  <strong>How to improve:</strong> {flaw.improvement_suggestion}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gemini AI Flaw Doctor Card */}
      <div className="white-card p-6 border-l-4 border-l-teal-600 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-600" />
              <span>Gemini AI Flaw Doctor & Vocal Prescription</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Deep physiological and acoustic root-cause diagnosis powered by Google Gemini AI.
            </p>
          </div>

          {!doctorDiagnosis && (
            <button
              type="button"
              onClick={handleConsultDoctor}
              disabled={isLoadingDoctor}
              className="px-4 py-2 bg-gradient-to-r from-teal-600 to-sky-600 hover:from-teal-700 hover:to-sky-700 text-white font-bold text-xs rounded-xl shadow-soft-teal transition-all flex items-center gap-1.5 self-start sm:self-auto"
            >
              {isLoadingDoctor ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Analyzing Acoustic Signals...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Diagnose with Gemini AI</span>
                </>
              )}
            </button>
          )}
        </div>

        {doctorError && (
          <p className="text-xs text-rose-600 font-semibold">{doctorError}</p>
        )}

        {doctorDiagnosis && (
          <div className="space-y-4 pt-2 border-t border-slate-100 animate-in fade-in duration-300">
            {/* Executive Summary */}
            <div className="p-4 bg-teal-50/60 rounded-xl border border-teal-200">
              <span className="text-xs font-bold text-teal-900 uppercase tracking-wide block mb-1">
                Executive Acoustic Diagnosis:
              </span>
              <p className="text-sm text-slate-800 leading-relaxed">
                {doctorDiagnosis.overall_summary}
              </p>
              <div className="mt-2 text-xs font-bold text-teal-700">
                Score Improvement Potential: <span className="text-emerald-700 font-extrabold">{doctorDiagnosis.score_potential}</span> on your next attempt
              </div>
            </div>

            {/* Primary Flaw Breakdown */}
            {doctorDiagnosis.primary_flaw_analysis && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Primary Detected Flaw
                  </span>
                  <p className="text-xs font-bold text-slate-900">
                    {doctorDiagnosis.primary_flaw_analysis.name}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-1 font-mono">
                    {doctorDiagnosis.primary_flaw_analysis.acoustic_evidence}
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Physiological Root Cause
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {doctorDiagnosis.primary_flaw_analysis.root_cause}
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Audience & Judge Perception
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {doctorDiagnosis.primary_flaw_analysis.audience_perception}
                  </p>
                </div>
              </div>
            )}

            {/* Prescribed Actionable Drills */}
            {doctorDiagnosis.actionable_drills?.length > 0 && (
              <div>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block mb-2">
                  Prescribed Physical Vocal Drills:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {doctorDiagnosis.actionable_drills.map((drill, dIdx) => (
                    <div key={dIdx} className="p-3.5 bg-white rounded-xl border border-teal-200 shadow-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-teal-900">{drill.name}</span>
                        <span className="text-[10px] font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                          {drill.duration}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{drill.instruction}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transcript with Clickable Words for Seeking */}
      <div className="white-card p-6">
        <h3 className="text-base font-bold text-slate-900 mb-2">
          Recognized Transcript & Word Alignment
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Click any word below to jump playback to that moment.
        </p>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 leading-relaxed text-sm">
          {result.words.map((w, i) => {
            const isPlaying = currentTime >= w.start && currentTime <= w.end;
            return (
              <span
                key={i}
                onClick={() => seekToTime(w.start)}
                className={`inline-block mr-1.5 my-0.5 px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                  isPlaying
                    ? 'bg-teal-600 text-white font-semibold shadow-sm'
                    : 'text-slate-800 hover:bg-teal-100 hover:text-teal-900'
                }`}
                title={`Click to jump to ${w.start.toFixed(1)}s`}
              >
                {w.word}
              </span>
            );
          })}
        </div>
      </div>

      {/* Collapsible Advanced Acoustic Evidence */}
      <div className="white-card p-6">
        <button
          type="button"
          onClick={() => setShowAdvancedMetrics(!showAdvancedMetrics)}
          className="w-full flex items-center justify-between text-left font-bold text-slate-800 text-base"
        >
          <span className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-teal-600" /> Advanced Mathematical & Signal Processing Evidence
          </span>
          {showAdvancedMetrics ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {showAdvancedMetrics && (
          <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-600 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="font-semibold block text-slate-800">PYIN Fundamental Frequency:</span>
                Median F0: {result.measurements.median_f0_hz.toFixed(1)} Hz &bull; Semitone &sigma;: {result.measurements.pitch_semitone_std.toFixed(2)}
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="font-semibold block text-slate-800">Dynamic Range & Noise:</span>
                RMS Dynamic Range: {result.measurements.dynamic_range_db.toFixed(1)} dB &bull; Estimated SNR: {result.measurements.snr_db.toFixed(1)} dB
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="font-semibold block text-slate-800">Whisper Alignment:</span>
                Confidence: {(result.measurements.alignment_confidence * 100).toFixed(1)}% &bull; Total Pauses: {result.measurements.pause_count}
              </div>
            </div>

            <div className="p-3 bg-teal-50/50 rounded-lg border border-teal-200 text-teal-900 font-mono text-[11px]">
              <strong>Formula Disclosure:</strong> {result.score.formula_explanation}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
