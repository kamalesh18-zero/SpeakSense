import React, { useState, useEffect } from 'react';
import {
  Database,
  Play,
  Pause,
  Plus,
  Trash2,
  Edit2,
  FileCode,
  FileSpreadsheet,
  CheckCircle2,
  BarChart3,
  Loader2,
  X,
  Save,
  Check,
} from 'lucide-react';
import {
  fetchScripts,
  fetchRecordings,
  fetchAnnotations,
  saveAnnotation,
  deleteAnnotation,
  runBenchmark,
} from '../services/api';
import { ScriptItem, RecordingItem, AnnotationItem, BenchmarkMetrics } from '../types';

export const ContrastiveDatasetPage: React.FC = () => {
  const [scripts, setScripts] = useState<ScriptItem[]>([]);
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState<string>('all');
  const [selectedSplit, setSelectedSplit] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Audio preview state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // Annotation Editor Modal
  const [editingAnnotation, setEditingAnnotation] = useState<Partial<AnnotationItem> | null>(null);

  // Benchmark metrics
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkMetrics | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    try {
      const [s, r, a] = await Promise.all([
        fetchScripts(),
        fetchRecordings(),
        fetchAnnotations(),
      ]);
      setScripts(s);
      setRecordings(r);
      setAnnotations(a);
    } catch (err: any) {
      console.error('Error loading dataset:', err);
    } finally {
      setLoading(false);
    }
  }

  const handlePlayAudio = (rec: RecordingItem) => {
    if (playingAudioId === rec.id) {
      audioRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audioUrl = `/media/recordings/${rec.filename}`;
      audioRef.current = new Audio(audioUrl);
      audioRef.current.play().catch(() => {});
      audioRef.current.onended = () => setPlayingAudioId(null);
      setPlayingAudioId(rec.id);
    }
  };

  const handleSaveAnnotation = async () => {
    if (!editingAnnotation) return;
    try {
      await saveAnnotation(editingAnnotation);
      setEditingAnnotation(null);
      await loadAllData();
    } catch (err: any) {
      alert('Failed to save annotation: ' + err.message);
    }
  };

  const handleDeleteAnnotation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this annotation?')) return;
    try {
      await deleteAnnotation(id);
      await loadAllData();
    } catch (err: any) {
      alert('Failed to delete annotation: ' + err.message);
    }
  };

  const handleRunEvaluation = async () => {
    setIsEvaluating(true);
    try {
      const res = await runBenchmark('test');
      setBenchmarkResult(res);
    } catch (err: any) {
      alert('Benchmark evaluation error: ' + err.message);
    } finally {
      setIsEvaluating(false);
    }
  };

  const filteredRecordings = recordings.filter((r) => {
    if (selectedScriptId !== 'all' && r.script_id !== selectedScriptId) return false;
    if (selectedSplit !== 'all' && r.split !== selectedSplit) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <Database className="w-6 h-6 text-teal-600" />
            <span>Custom Contrastive Dataset Manager</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            30 verified speech recordings across 5 original scripts and 6 delivery variations with ground truth flaw boundaries.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <a
            href="/api/dataset/export/json"
            download="speaksense_dataset.json"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-teal-800 shadow-xs transition-all"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </a>
          <a
            href="/api/dataset/export/csv"
            download="speaksense_annotations.csv"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-sky-800 shadow-xs transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Benchmark Evaluation Card */}
      <div className="white-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-extrabold text-slate-900">Automated Ground-Truth Validation Benchmark</span>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 font-bold font-mono">
                Held-Out Test Split (Script 5)
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Evaluates temporal flaw detector against human/calibrated ground-truth annotations to measure Precision, Recall, F1, and Temporal IoU.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRunEvaluation}
            disabled={isEvaluating}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-soft-teal disabled:opacity-50 transition-all whitespace-nowrap self-start sm:self-auto"
          >
            {isEvaluating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Running Benchmark...</span>
              </>
            ) : (
              <>
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Run Validation Benchmark</span>
              </>
            )}
          </button>
        </div>

        {benchmarkResult && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 font-mono">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Precision</p>
              <p className="text-lg font-black text-teal-800 mt-0.5">
                {(benchmarkResult.precision * 100).toFixed(1)}%
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Recall</p>
              <p className="text-lg font-black text-sky-800 mt-0.5">
                {(benchmarkResult.recall * 100).toFixed(1)}%
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase">F1-Score</p>
              <p className="text-lg font-black text-indigo-800 mt-0.5">
                {(benchmarkResult.f1_score * 100).toFixed(1)}%
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Temporal IoU</p>
              <p className="text-lg font-black text-amber-800 mt-0.5">
                {((benchmarkResult.temporal_mean_iou || 0) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Samples Evaluated</p>
              <p className="text-lg font-black text-slate-800 mt-0.5">
                {benchmarkResult.total_samples || 0} recs
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Dataset Browser Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-slate-800">Filters:</span>
          <select
            value={selectedScriptId}
            onChange={(e) => setSelectedScriptId(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-800 font-medium"
          >
            <option value="all">All Scripts (1 to 5)</option>
            {scripts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>

          <select
            value={selectedSplit}
            onChange={(e) => setSelectedSplit(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-800 font-medium"
          >
            <option value="all">All Splits</option>
            <option value="train">Train (Scripts 1-3)</option>
            <option value="val">Validation (Script 4)</option>
            <option value="test">Test (Script 5)</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() =>
            setEditingAnnotation({
              sample_id: recordings[0]?.id || '',
              script_id: recordings[0]?.script_id || 'script_1',
              flaw_category: 'awkward_pause',
              flaw_start: 1.0,
              flaw_end: 2.0,
              severity: 2,
              label_source: 'expert_reviewer',
              annotation_confidence: 1.0,
            })
          }
          className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold transition-all shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Ground Truth Annotation</span>
        </button>
      </div>

      {/* Recordings & Ground Truth Annotations Table */}
      <div className="white-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold text-[11px]">
              <tr>
                <th className="py-3 px-4">Preview</th>
                <th className="py-3 px-4">Recording ID</th>
                <th className="py-3 px-4">Script</th>
                <th className="py-3 px-4">Delivery Variant</th>
                <th className="py-3 px-4">Split</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Ground Truth Flaws</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecordings.map((rec) => {
                const recAnnotations = annotations.filter((a) => a.sample_id === rec.id);
                const isPlaying = playingAudioId === rec.id;

                return (
                  <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => handlePlayAudio(rec)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                          isPlaying
                            ? 'bg-rose-500 text-white'
                            : 'bg-teal-100 text-teal-800 hover:bg-teal-200'
                        }`}
                      >
                        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                      </button>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] font-bold text-slate-900">{rec.id}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{rec.script_id}</td>
                    <td className="py-3 px-4">
                      <span className="capitalize font-bold text-slate-700">
                        {rec.delivery_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase font-mono">
                        {rec.split}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{rec.duration_sec.toFixed(1)}s</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {recAnnotations.length === 0 ? (
                          <span className="text-[11px] text-slate-400 italic">None (Ideal Reference)</span>
                        ) : (
                          recAnnotations.map((ann) => (
                            <span
                              key={ann.id}
                              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200"
                            >
                              <span>{ann.flaw_category} ({ann.flaw_start.toFixed(1)}s-{ann.flaw_end.toFixed(1)}s)</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteAnnotation(ann.id)}
                                className="text-slate-400 hover:text-rose-600 ml-1"
                              >
                                &times;
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Annotation Modal */}
      {editingAnnotation && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white p-6 rounded-2xl border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                <Plus className="w-4 h-4 text-teal-600" />
                <span>Add Ground Truth Flaw Annotation</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingAnnotation(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Target Recording:</label>
                <select
                  value={editingAnnotation.sample_id}
                  onChange={(e) => setEditingAnnotation({ ...editingAnnotation, sample_id: e.target.value })}
                  className="w-full p-2 rounded-xl bg-white border border-slate-300 text-slate-800 font-mono"
                >
                  {recordings.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} ({r.delivery_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Flaw Category:</label>
                <select
                  value={editingAnnotation.flaw_category}
                  onChange={(e) => setEditingAnnotation({ ...editingAnnotation, flaw_category: e.target.value })}
                  className="w-full p-2 rounded-xl bg-white border border-slate-300 text-slate-800 font-medium"
                >
                  <option value="excessive_speed">Excessive Speed</option>
                  <option value="excessive_slow">Excessive Slow</option>
                  <option value="awkward_pause">Awkward Pause</option>
                  <option value="monotone_pitch">Monotone Pitch</option>
                  <option value="energy_drop">Energy Drop</option>
                  <option value="misplaced_emphasis">Misplaced Emphasis</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Start Time (sec):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingAnnotation.flaw_start}
                    onChange={(e) => setEditingAnnotation({ ...editingAnnotation, flaw_start: parseFloat(e.target.value) })}
                    className="w-full p-2 rounded-xl bg-white border border-slate-300 text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">End Time (sec):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingAnnotation.flaw_end}
                    onChange={(e) => setEditingAnnotation({ ...editingAnnotation, flaw_end: parseFloat(e.target.value) })}
                    className="w-full p-2 rounded-xl bg-white border border-slate-300 text-slate-800 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setEditingAnnotation(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAnnotation}
                className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-soft-teal"
              >
                Save Annotation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
