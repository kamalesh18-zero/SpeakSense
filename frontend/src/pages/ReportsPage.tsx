import React from 'react';
import {
  FileText,
  Award,
  Download,
  Printer,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Info,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { ContrastiveAnalysisResult } from '../types';

interface ReportsPageProps {
  analysis: ContrastiveAnalysisResult | null;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ analysis }) => {
  if (!analysis) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center space-y-4">
        <FileText className="w-12 h-12 text-cyan-400 mx-auto opacity-60" />
        <h3 className="text-lg font-bold text-white">No Analysis Report Available</h3>
        <p className="text-xs text-slate-400">
          Run an evaluation in the Speech Analysis Studio to generate a complete rubric report.
        </p>
      </div>
    );
  }

  const { score, flaws, participant_features, reference_features, alignment, preset_name, timestamp } =
    analysis;

  // Radar chart data for rubric categories
  const radarData = score.categories.map((c) => ({
    category: c.name.split('&')[0].trim(),
    score: c.score,
    maxScore: c.max_score,
    normalizedPct: Math.round((c.score / c.max_score) * 100),
  }));

  const downloadJsonReport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(analysis, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `speaksense_report_${analysis.analysis_id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const printPdfReport = () => {
    window.print();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 print:p-0 print:space-y-4">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              OFFICIAL SPEECH EVALUATION REPORT
            </span>
            <span className="text-xs text-slate-500 font-mono">
              ID: {analysis.analysis_id}
            </span>
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight mt-1">
            Rubric-Based Delivery Performance Report
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Competition Preset: {preset_name.toUpperCase()} • Generated: {new Date(timestamp).toLocaleString()}
          </p>
        </div>

        <div className="flex items-center space-x-2 print:hidden self-start sm:self-auto">
          <button
            onClick={downloadJsonReport}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-navy-800 hover:bg-navy-700 border border-slate-700 text-xs font-semibold text-cyan-400 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download JSON</span>
          </button>
          <button
            onClick={printPdfReport}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-navy-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {/* Executive Summary Card */}
      <div className="glass-panel p-6 rounded-2xl border-cyan-500/30 shadow-xl grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Rubric Score
          </p>
          <div className="flex items-baseline space-x-2 mt-2">
            <span className="text-5xl font-black bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
              {score.total_score}
            </span>
            <span className="text-lg font-semibold text-slate-400">/ 100</span>
          </div>
          <p className="text-xs font-medium text-teal-400 mt-1">
            Deterministic Grade: {score.total_score >= 90 ? 'Superior' : score.total_score >= 80 ? 'Excellent' : score.total_score >= 70 ? 'Proficient' : 'Needs Development'}
          </p>
          <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
            {score.formula_explanation}
          </p>
        </div>

        {/* Radar Chart */}
        <div className="md:col-span-2 h-56 w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="category" stroke="#94A3B8" fontSize={11} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" fontSize={9} />
              <Radar
                name="Score %"
                dataKey="normalizedPct"
                stroke="#06B6D4"
                fill="#06B6D4"
                fillOpacity={0.4}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Breakdown Table */}
      <div className="glass-panel p-6 rounded-2xl border-slate-700/80 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <Award className="w-4 h-4 text-teal-400" />
          <span>Category Breakdown & Measurement Evidence</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-navy-900 border-b border-slate-800 text-slate-400 text-[11px]">
              <tr>
                <th className="py-2.5 px-3 font-medium">Rubric Category</th>
                <th className="py-2.5 px-3 font-medium">Score / Max</th>
                <th className="py-2.5 px-3 font-medium">Evidence & Penalties Applied</th>
                <th className="py-2.5 px-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {score.categories.map((cat) => (
                <tr key={cat.category_id} className="hover:bg-navy-800/30">
                  <td className="py-3 px-3 font-semibold text-white">
                    {cat.name}
                    <span className="block text-[10px] text-slate-400 font-normal">
                      Weight: {cat.weight_pct}%
                    </span>
                  </td>

                  <td className="py-3 px-3 font-mono font-bold text-cyan-400">
                    {cat.score} <span className="text-slate-500 font-normal">/ {cat.max_score}</span>
                  </td>

                  <td className="py-3 px-3 space-y-1">
                    <p className="text-slate-300 text-[11px]">{cat.evidence_summary}</p>
                    {cat.penalties_applied.length > 0 && (
                      <div className="space-y-0.5">
                        {cat.penalties_applied.map((p, i) => (
                          <span
                            key={i}
                            className="inline-block mr-2 px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-mono"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  <td className="py-3 px-3 text-right">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        cat.status === 'measured'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {cat.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Itemized Detected Flaws & Recommendations */}
      <div className="glass-panel p-6 rounded-2xl border-slate-700/80 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>Itemized Delivery Flaws & Actionable Coaching</span>
        </h3>

        {flaws.length === 0 ? (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
            No critical temporal flaws detected. Delivery adhered closely to ideal pacing and pause cadence.
          </div>
        ) : (
          <div className="space-y-3">
            {flaws.map((flaw, idx) => (
              <div
                key={flaw.flaw_id}
                className="p-4 rounded-xl bg-navy-900 border border-slate-700/60 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white capitalize">
                      {idx + 1}. {flaw.flaw_type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-navy-800 text-cyan-400">
                      {flaw.start_time.toFixed(2)}s – {flaw.end_time.toFixed(2)}s
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-rose-400 font-semibold">
                    {flaw.relative_difference_pct > 0 ? '+' : ''}
                    {flaw.relative_difference_pct.toFixed(1)}% vs Ref
                  </span>
                </div>

                <p className="text-slate-300 leading-relaxed font-sans">{flaw.explanation}</p>

                <div className="p-2.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-300 text-[11px]">
                  <strong>Coach Recommendation:</strong> {flaw.improvement_suggestion}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Methodological Integrity & Reliability Disclosure */}
      <div className="p-5 rounded-xl bg-navy-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-2 font-sans">
        <div className="flex items-center space-x-1.5 text-slate-300 font-semibold">
          <Info className="w-4 h-4 text-cyan-400" />
          <span>Evaluation Methodology & Scientific Integrity Statement</span>
        </div>
        <p className="leading-relaxed">
          SpeakSense AI calculates all evaluation metrics deterministically from acoustic signal processing
          (Short-Time Fourier Transform, Mel-Frequency Cepstral Coefficients, pYIN fundamental frequency tracking,
          and Faster-Whisper word-level forced alignment). No subjective psychological inferences or invented timestamps
          are generated. Accents and natural voice pitch ranges are normalized using speaker-median semitones to ensure zero demographic penalty.
        </p>
      </div>
    </div>
  );
};
