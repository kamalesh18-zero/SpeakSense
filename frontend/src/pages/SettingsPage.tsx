import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Cpu,
  Sliders,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  Server,
} from 'lucide-react';
import { fetchSettings, updateSettings, fetchHealth } from '../services/api';

export const SettingsPage: React.FC = () => {
  const [thresholds, setThresholds] = useState<any>({
    speed_excessive_rel_pct: 25.0,
    speed_slow_rel_pct: -25.0,
    pause_excessive_sec: 1.2,
    pause_mid_phrase_sec: 0.45,
    pitch_monotony_semitone_std: 1.6,
    energy_drop_db: 12.0,
  });
  const [hardwareInfo, setHardwareInfo] = useState<any>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchSettings()
      .then((data) => {
        if (data.thresholds) {
          setThresholds(data.thresholds);
        }
      })
      .catch((err) => console.error(err));

    fetchHealth()
      .then((data) => setHardwareInfo(data))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    try {
      await updateSettings({ thresholds });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      alert('Failed to update settings: ' + err.message);
    }
  };

  const handleResetDefaults = () => {
    setThresholds({
      speed_excessive_rel_pct: 25.0,
      speed_slow_rel_pct: -25.0,
      pause_excessive_sec: 1.2,
      pause_mid_phrase_sec: 0.45,
      pitch_monotony_semitone_std: 1.6,
      energy_drop_db: 12.0,
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <SettingsIcon className="w-6 h-6 text-teal-600" />
            <span>Settings & Acoustic Threshold Tuning</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Configure detector sensitivity, mathematical thresholds, and inspect underlying AI hardware status.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-all shadow-soft-teal"
        >
          {saveSuccess ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>Saved!</span>
            </>
          ) : (
            <span>Save Thresholds</span>
          )}
        </button>
      </div>

      {/* Hardware Status Card */}
      <div className="white-card p-6 space-y-4">
        <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
          <Cpu className="w-4 h-4 text-teal-600" />
          <span>Active Inference Engine & Hardware Status</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-[10px] text-slate-500 font-sans font-bold uppercase">OS Platform</p>
            <p className="text-sm font-black text-slate-900 mt-0.5">
              {hardwareInfo?.platform || 'Windows 11'}
            </p>
            <p className="text-[10px] text-teal-700 font-bold">x86_64 Multi-core</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-[10px] text-slate-500 font-sans font-bold uppercase">Whisper Backend</p>
            <p className="text-sm font-black text-teal-800 mt-0.5">Faster-Whisper</p>
            <p className="text-[10px] text-slate-500 font-semibold">INT8 CPU Quantized</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-[10px] text-slate-500 font-sans font-bold uppercase">CTranslate2</p>
            <p className="text-sm font-black text-slate-900 mt-0.5">
              v{hardwareInfo?.ctranslate2_version || '4.8.3'}
            </p>
            <p className="text-[10px] text-emerald-700 font-bold">Engine Active</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-[10px] text-slate-500 font-sans font-bold uppercase">DSP Audio Suite</p>
            <p className="text-sm font-black text-slate-900 mt-0.5">Librosa + SF</p>
            <p className="text-[10px] text-slate-500 font-semibold">FFmpeg Bound</p>
          </div>
        </div>
      </div>

      {/* Threshold Sliders */}
      <div className="white-card p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-teal-600" />
            <span>Temporal Flaw Detection Thresholds</span>
          </h3>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-xs text-slate-500 hover:text-teal-700 font-bold flex items-center space-x-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Defaults</span>
          </button>
        </div>

        <div className="space-y-5 text-xs">
          {/* Excessive Speed % */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="font-bold text-slate-800">Excessive Speaking Pace Trigger</span>
              <span className="font-mono text-teal-700 font-extrabold">
                +{thresholds.speed_excessive_rel_pct || 25}% faster than reference
              </span>
            </div>
            <input
              type="range"
              min={15}
              max={50}
              step={1}
              value={thresholds.speed_excessive_rel_pct || 25}
              onChange={(e) =>
                setThresholds({
                  ...thresholds,
                  speed_excessive_rel_pct: parseFloat(e.target.value),
                })
              }
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
            />
          </div>

          {/* Excessive Pauses Limit */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="font-bold text-slate-800">Phrase-Boundary Pause Limit</span>
              <span className="font-mono text-teal-700 font-extrabold">
                {thresholds.pause_excessive_sec || 1.2} seconds
              </span>
            </div>
            <input
              type="range"
              min={0.8}
              max={2.5}
              step={0.1}
              value={thresholds.pause_excessive_sec || 1.2}
              onChange={(e) =>
                setThresholds({
                  ...thresholds,
                  pause_excessive_sec: parseFloat(e.target.value),
                })
              }
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
            />
          </div>

          {/* Mid-phrase Pause Limit */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="font-bold text-slate-800">Suspicious Mid-Phrase Pause Limit</span>
              <span className="font-mono text-teal-700 font-extrabold">
                {thresholds.pause_mid_phrase_sec || 0.45} seconds
              </span>
            </div>
            <input
              type="range"
              min={0.3}
              max={1.0}
              step={0.05}
              value={thresholds.pause_mid_phrase_sec || 0.45}
              onChange={(e) =>
                setThresholds({
                  ...thresholds,
                  pause_mid_phrase_sec: parseFloat(e.target.value),
                })
              }
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
            />
          </div>

          {/* Pitch Monotony Limit */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="font-bold text-slate-800">Pitch Monotony Standard Deviation Limit</span>
              <span className="font-mono text-teal-700 font-extrabold">
                &lt; {thresholds.pitch_monotony_semitone_std || 1.6} semitones
              </span>
            </div>
            <input
              type="range"
              min={1.0}
              max={2.5}
              step={0.1}
              value={thresholds.pitch_monotony_semitone_std || 1.6}
              onChange={(e) =>
                setThresholds({
                  ...thresholds,
                  pitch_monotony_semitone_std: parseFloat(e.target.value),
                })
              }
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
