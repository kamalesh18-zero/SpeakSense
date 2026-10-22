import React, { useState, useEffect } from 'react';
import { Sliders, RotateCcw, Check, Sparkles, AlertCircle, Info } from 'lucide-react';
import { fetchBenchmarkProfiles, updateBenchmarkProfile, resetBenchmarkProfiles } from '../services/api';
import { BenchmarkProfile } from '../types';

export const BenchmarkProfilesPage: React.FC = () => {
  const [profiles, setProfiles] = useState<BenchmarkProfile[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('public_speaking');
  const [editingProfile, setEditingProfile] = useState<BenchmarkProfile | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = () => {
    fetchBenchmarkProfiles()
      .then((data) => {
        setProfiles(data);
        const current = data.find((p) => p.category_key === selectedKey) || data[0];
        if (current) {
          setSelectedKey(current.category_key);
          setEditingProfile({ ...current });
        }
      })
      .catch((err) => console.error('Failed to load profiles', err));
  };

  const handleSelectCategory = (key: string) => {
    setSelectedKey(key);
    const found = profiles.find((p) => p.category_key === key);
    if (found) {
      setEditingProfile({ ...found });
      setSuccessMsg(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;
    setIsSaving(true);
    setSuccessMsg(null);

    try {
      const updated = await updateBenchmarkProfile(selectedKey, editingProfile);
      setEditingProfile({ ...updated });
      setProfiles((prev) =>
        prev.map((p) => (p.category_key === selectedKey ? updated : p))
      );
      setIsSaving(false);
      setSuccessMsg('Benchmark targets updated successfully!');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm('Reset all 6 category benchmarks back to official baseline standards?')) return;
    try {
      const resetList = await resetBenchmarkProfiles();
      setProfiles(resetList);
      const current = resetList.find((p) => p.category_key === selectedKey) || resetList[0];
      if (current) {
        setEditingProfile({ ...current });
      }
      setSuccessMsg('Defaults restored successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      alert('Failed to reset benchmarks.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
            <Sliders className="w-3.5 h-3.5" /> Acoustic Targets & Rubric Weights
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Speech Benchmark Engine Profiles
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure expected WPM cadence, pause durations, pitch variability thresholds, and rubric point weights.
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetDefaults}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 shadow-sm transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500" /> Reset to Baseline Defaults
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-teal-50 border border-teal-200 text-teal-800 rounded-xl text-xs font-medium flex items-center gap-2">
          <Check className="w-4 h-4 text-teal-600" /> {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Category Selector Tabs (4 cols) */}
        <div className="lg:col-span-4 space-y-2">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 mb-2">
            Built-in Categories
          </h2>
          {profiles.map((p) => {
            const isSelected = p.category_key === selectedKey;
            return (
              <button
                key={p.category_key}
                type="button"
                onClick={() => handleSelectCategory(p.category_key)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-white border-teal-500 ring-2 ring-teal-500/20 shadow-soft-sm'
                    : 'bg-slate-50 border-slate-200 hover:bg-white text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-slate-900">{p.name}</span>
                  <span className="text-[11px] font-mono text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                    {p.target_wpm_min}–{p.target_wpm_max} WPM
                  </span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">{p.description}</p>
              </button>
            );
          })}
        </div>

        {/* Editor Form (8 cols) */}
        {editingProfile && (
          <form onSubmit={handleSave} className="lg:col-span-8 white-card p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">
                Editing Targets for: {editingProfile.name}
              </h2>
              <p className="text-xs text-slate-500">
                Adjusting these targets modifies how the single-audio benchmark engine evaluates recordings for this category.
              </p>
            </div>

            {/* Target Cadence & WPM */}
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                Speaking Rate (Words Per Minute)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Minimum Target WPM
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={editingProfile.target_wpm_min}
                    onChange={(e) =>
                      setEditingProfile({
                        ...editingProfile,
                        target_wpm_min: parseFloat(e.target.value) || 100,
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Maximum Target WPM
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={editingProfile.target_wpm_max}
                    onChange={(e) =>
                      setEditingProfile({
                        ...editingProfile,
                        target_wpm_max: parseFloat(e.target.value) || 160,
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Pauses */}
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                Pause Duration Limits (Seconds)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Ideal Pause Min (sec)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={editingProfile.target_pause_min_sec}
                    onChange={(e) =>
                      setEditingProfile({
                        ...editingProfile,
                        target_pause_min_sec: parseFloat(e.target.value) || 0.4,
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Ideal Pause Max (sec)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={editingProfile.target_pause_max_sec}
                    onChange={(e) =>
                      setEditingProfile({
                        ...editingProfile,
                        target_pause_max_sec: parseFloat(e.target.value) || 1.8,
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Pitch & Energy */}
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                Pitch Expressiveness & Dynamic Range
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Min Pitch Std (Semitones)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingProfile.target_pitch_std_min}
                    onChange={(e) =>
                      setEditingProfile({
                        ...editingProfile,
                        target_pitch_std_min: parseFloat(e.target.value) || 1.5,
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Max Pitch Std (Semitones)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingProfile.target_pitch_std_max}
                    onChange={(e) =>
                      setEditingProfile({
                        ...editingProfile,
                        target_pitch_std_max: parseFloat(e.target.value) || 4.5,
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Min Dynamic Range (dB)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={editingProfile.target_dyn_range_min_db}
                    onChange={(e) =>
                      setEditingProfile({
                        ...editingProfile,
                        target_dyn_range_min_db: parseFloat(e.target.value) || 12,
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Rubric Weights */}
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                Rubric Category Weights (Must sum to 100%)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {Object.entries(editingProfile.weights).map(([k, v]) => (
                  <div key={k}>
                    <label className="block text-[11px] font-semibold text-slate-600 capitalize mb-1">
                      {k.replace(/_/g, ' ')}
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={v}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setEditingProfile({
                          ...editingProfile,
                          weights: {
                            ...editingProfile.weights,
                            [k]: val,
                          },
                        });
                      }}
                      className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 text-center"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs shadow-soft-teal transition-all flex items-center gap-2"
              >
                {isSaving ? 'Saving Changes...' : 'Save Category Benchmark'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
