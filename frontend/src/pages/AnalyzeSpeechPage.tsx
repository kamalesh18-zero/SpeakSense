import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Upload,
  Play,
  CheckCircle2,
  AlertCircle,
  FileText,
  Sliders,
  Sparkles,
  ArrowRight,
  Disc,
  StopCircle,
  Loader2,
} from 'lucide-react';
import {
  fetchScripts,
  fetchRecordings,
  uploadAudioFile,
  executeSpeechAnalysis,
} from '../services/api';
import { ScriptItem, RecordingItem, ContrastiveAnalysisResult } from '../types';
import { AITopicScriptModal } from '../components/AITopicScriptModal';

interface AnalyzeSpeechPageProps {
  onAnalysisComplete: (result: ContrastiveAnalysisResult) => void;
  initialScriptId?: string;
  initialDeliveryType?: string;
}

export const AnalyzeSpeechPage: React.FC<AnalyzeSpeechPageProps> = ({
  onAnalysisComplete,
  initialScriptId,
  initialDeliveryType,
}) => {
  const [scripts, setScripts] = useState<ScriptItem[]>([]);
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState<string>(initialScriptId || 'script_1');
  const [selectedDelivery, setSelectedDelivery] = useState<string>(initialDeliveryType || 'excessively_fast');
  const [useCustomAudio, setUseCustomAudio] = useState(false);

  // Custom audio & transcript states
  const [customRefPath, setCustomRefPath] = useState<string>('');
  const [customPartPath, setCustomPartPath] = useState<string>('');
  const [transcript, setTranscript] = useState<string>('');
  const [presetName, setPresetName] = useState<string>('persuasive_oratory');

  // AI Script Modal state
  const [showAiModal, setShowAiModal] = useState(false);

  // Microphone recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Analysis status
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const steps = [
    'Decoding & Acoustic Preprocessing (16kHz mono, SNR, Clipping, VAD)',
    'Faster-Whisper Forced Word Alignment (Acoustic Cross-Attention)',
    'Feature Extraction (FFT, MFCCs, pYIN F0 Pitch, RMS Energy, Pauses)',
    'Dynamic Time Warping (DTW) & Localized Flaw Detection',
    'Deterministic 100-Point Rubric Scoring & Explainability Report',
  ];

  // Load scripts and recordings
  useEffect(() => {
    async function init() {
      try {
        const [s, r] = await Promise.all([fetchScripts(), fetchRecordings()]);
        setScripts(s);
        setRecordings(r);
        const curScript = s.find((item) => item.id === (initialScriptId || 'script_1'));
        if (curScript) {
          setTranscript(curScript.transcript);
          setPresetName(curScript.category || 'persuasive_oratory');
        }
      } catch (err: any) {
        console.error('Failed to load initial data:', err);
      }
    }
    init();
  }, [initialScriptId]);

  // When selected script changes in preset mode
  const handleScriptChange = (sId: string) => {
    setSelectedScriptId(sId);
    const found = scripts.find((s) => s.id === sId);
    if (found) {
      setTranscript(found.transcript);
      setPresetName(found.category || 'persuasive_oratory');
    }
  };

  // Upload handler for custom file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'reference' | 'participant') => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadAudioFile(file, type);
      if (type === 'reference') {
        setCustomRefPath(res.filepath);
      } else {
        setCustomPartPath(res.filepath);
      }
    } catch (err: any) {
      setErrorMessage(`Upload failed: ${err.message}`);
    }
  };

  // Microphone recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const file = new File([audioBlob], `mic_participant_${Date.now()}.wav`, { type: 'audio/wav' });
        try {
          const res = await uploadAudioFile(file, 'participant');
          setCustomPartPath(res.filepath);
        } catch (e: any) {
          setErrorMessage('Failed to save microphone recording: ' + e.message);
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setErrorMessage('Microphone access denied or unavailable: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  // Start Analysis Pipeline
  const runAnalysis = async () => {
    setErrorMessage(null);
    setIsAnalyzing(true);
    setActiveStep(1);

    let refPath = customRefPath;
    let partPath = customPartPath;
    let scriptIdParam: string | undefined = undefined;

    if (!useCustomAudio) {
      // Use recordings from dataset
      refPath = `data/recordings/${selectedScriptId}_ideal_reference.wav`;
      partPath = `data/recordings/${selectedScriptId}_${selectedDelivery}.wav`;
      scriptIdParam = selectedScriptId;
    } else {
      if (!refPath || !partPath) {
        setErrorMessage('Please upload both Reference and Participant audio files.');
        setIsAnalyzing(false);
        return;
      }
    }

    if (!transcript.trim()) {
      setErrorMessage('Transcript cannot be empty. Please enter the speech text.');
      setIsAnalyzing(false);
      return;
    }

    // Step progression animation
    const stepInterval = setInterval(() => {
      setActiveStep((prev) => (prev < 4 ? prev + 1 : prev));
    }, 1200);

    try {
      const result = await executeSpeechAnalysis({
        referencePath: refPath,
        participantPath: partPath,
        transcript: transcript.trim(),
        presetName: presetName,
        scriptId: scriptIdParam,
      });

      clearInterval(stepInterval);
      setActiveStep(5);
      setTimeout(() => {
        setIsAnalyzing(false);
        onAnalysisComplete(result);
      }, 500);
    } catch (err: any) {
      clearInterval(stepInterval);
      setIsAnalyzing(false);
      setErrorMessage(err.message || 'Analysis failed. Please check transcripts and audio formats.');
    }
  };

  const handleSelectAiScript = (generated: { title: string; transcript: string; category: string }) => {
    setTranscript(generated.transcript);
    setPresetName(generated.category);
    setUseCustomAudio(true);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header with High-Contrast Text */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <Mic className="w-6 h-6 text-teal-600" />
            <span>Speech Analysis Studio</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Pair an ideal reference speech with a participant delivery to pinpoint localized delivery flaws using real acoustic signal processing.
          </p>
        </div>

        {/* Generate Custom Topic Script with AI */}
        <button
          type="button"
          onClick={() => setShowAiModal(true)}
          className="self-start sm:self-auto px-4 py-2.5 bg-gradient-to-r from-teal-600 to-sky-600 hover:from-teal-700 hover:to-sky-700 text-white rounded-xl text-xs font-bold shadow-soft-teal transition-all flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          <span>Generate Topic Speech with AI</span>
        </button>
      </div>

      {/* Mode Toggle: Calibrated Competition Demos vs Custom Audio */}
      <div className="flex rounded-xl bg-slate-200/90 p-1 border border-slate-300 max-w-md shadow-xs">
        <button
          type="button"
          onClick={() => setUseCustomAudio(false)}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
            !useCustomAudio
              ? 'bg-white text-teal-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Preset Competition Scripts (30 Demos)
        </button>
        <button
          type="button"
          onClick={() => setUseCustomAudio(true)}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
            useCustomAudio
              ? 'bg-white text-teal-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Custom Audio Upload & Mic
        </button>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-rose-800 text-xs">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <div>
            <p className="font-bold text-rose-900">Processing Error</p>
            <p className="mt-0.5 text-rose-700">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Main Configuration Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Audio Selection */}
        <div className="lg:col-span-2 space-y-5">
          {!useCustomAudio ? (
            /* Preset Mode */
            <div className="white-card p-6 space-y-5">
              <h3 className="text-sm font-extrabold text-slate-900 tracking-wide flex items-center space-x-2">
                <FileText className="w-4 h-4 text-teal-600" />
                <span>Select Standard Competition Script</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {scripts.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleScriptChange(s.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      selectedScriptId === s.id
                        ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-500/20 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-900">{s.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 font-bold font-mono">
                        ~{s.target_duration_sec}s
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-2 leading-relaxed">{s.description}</p>
                  </div>
                ))}
              </div>

              {/* Delivery Flaw Variation Selector */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-800 mb-2">
                  Select Participant Delivery Variation to Counterpoint:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'excessively_fast', label: 'Excessively Fast', desc: 'Rushed WPM & phrasing' },
                    { id: 'flat_monotonous', label: 'Flat Monotonous', desc: 'Low pitch variation' },
                    { id: 'awkward_pauses', label: 'Awkward Pauses', desc: 'Mid-phrase hesitations' },
                    { id: 'misplaced_emphasis', label: 'Misplaced Emphasis', desc: 'Erratic syllable stress' },
                    { id: 'near_perfect', label: 'Near-Perfect', desc: 'Polished competition delivery' },
                    { id: 'ideal_reference', label: 'Ideal Reference', desc: 'Baseline control speech' },
                  ].map((v) => (
                    <div
                      key={v.id}
                      onClick={() => setSelectedDelivery(v.id)}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        selectedDelivery === v.id
                          ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-500/20 text-teal-950 font-bold shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <p className="text-xs font-bold">{v.label}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{v.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Custom Audio Upload Mode */
            <div className="white-card p-6 space-y-6">
              <h3 className="text-sm font-extrabold text-slate-900 tracking-wide flex items-center space-x-2">
                <Upload className="w-4 h-4 text-teal-600" />
                <span>Upload Custom WAV / MP3 Audio</span>
              </h3>

              {/* Reference Audio Upload */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">1. Ideal Reference Audio</span>
                  {customRefPath && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-bold font-mono flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Loaded</span>
                    </span>
                  )}
                </div>
                <input
                  type="file"
                  accept="audio/wav,audio/mp3,audio/mpeg,audio/flac"
                  onChange={(e) => handleFileUpload(e, 'reference')}
                  className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-teal-600 file:text-white hover:file:bg-teal-700 cursor-pointer"
                />
              </div>

              {/* Participant Audio Upload or Mic */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">2. Participant Audio</span>
                  {customPartPath && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-bold font-mono flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Loaded</span>
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="audio/wav,audio/mp3,audio/mpeg,audio/flac"
                      onChange={(e) => handleFileUpload(e, 'participant')}
                      className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-sky-600 file:text-white hover:file:bg-sky-700 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-400 font-bold">or</span>
                    {!isRecording ? (
                      <button
                        type="button"
                        onClick={startRecording}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-300 text-xs font-bold hover:bg-rose-100 transition-all shadow-xs"
                      >
                        <Disc className="w-3.5 h-3.5 text-rose-600" />
                        <span>Record Mic</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold animate-pulse shadow-sm"
                      >
                        <StopCircle className="w-3.5 h-3.5" />
                        <span>Stop ({recordingDuration}s)</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Transcript Box */}
          <div className="white-card p-5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">
                Canonical Speech Transcript (Word-level Ground Truth):
              </label>
              <span className="text-[11px] text-teal-800 font-mono font-bold bg-teal-50 px-2 py-0.5 rounded">
                {transcript.split(/\s+/).filter(Boolean).length} words
              </span>
            </div>
            <textarea
              rows={4}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste or edit the exact transcript spoken by both speakers..."
              className="w-full rounded-xl bg-slate-50 border border-slate-300 p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 leading-relaxed font-sans"
            />
          </div>
        </div>

        {/* Right Column: Settings & Launch */}
        <div className="space-y-5">
          <div className="white-card p-5 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 tracking-wide flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-teal-600" />
              <span>Competition Rubric Preset</span>
            </h3>

            <div className="space-y-2">
              {[
                { id: 'persuasive_oratory', name: 'Persuasive Oratory', desc: 'High pacing & rhetorical pause weight' },
                { id: 'declamation', name: 'Declamation', desc: 'Focus on dramatic inflection & projection' },
                { id: 'extemporaneous', name: 'Extemporaneous', desc: 'Balanced analytical cadence & clarity' },
                { id: 'interpretive_reading', name: 'Interpretive Reading', desc: 'High pause sensitivity & vocal range' },
              ].map((p) => (
                <div
                  key={p.id}
                  onClick={() => setPresetName(p.id)}
                  className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                    presetName === p.id
                      ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-500/20 text-teal-950 font-bold shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <p className="text-xs font-bold">{p.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{p.desc}</p>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800">Deterministic Acoustic Engine:</p>
              <p>&bull; Faster-Whisper Word Alignment</p>
              <p>&bull; Librosa pYIN Pitch Semitones</p>
              <p>&bull; Dynamic Time Warping (DTW)</p>
              <p>&bull; Ground-Truth Flaw Explanations</p>
            </div>
          </div>

          {/* Launch Button */}
          <button
            type="button"
            onClick={runAnalysis}
            disabled={isAnalyzing}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 shadow-lg transition-all ${
              isAnalyzing
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                : 'bg-teal-600 hover:bg-teal-700 text-white shadow-soft-teal'
            }`}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                <span>Running Acoustic Analysis...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Start Real Acoustic Analysis</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Real-time Multi-Stage Progress Modal */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white p-6 rounded-2xl border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 border border-teal-200 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-teal-600 animate-spin" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">Analyzing Speech Alignment</h4>
                <p className="text-xs text-slate-500">Processing acoustic evidence...</p>
              </div>
            </div>

            <div className="space-y-3">
              {steps.map((st, idx) => {
                const isDone = activeStep > idx + 1;
                const isCurrent = activeStep === idx + 1;
                return (
                  <div key={idx} className="flex items-start space-x-2.5 text-xs">
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    ) : isCurrent ? (
                      <Loader2 className="w-4 h-4 text-teal-600 animate-spin flex-shrink-0 mt-0.5" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-300 flex-shrink-0 mt-0.5" />
                    )}
                    <span
                      className={`${
                        isDone ? 'text-slate-500' : isCurrent ? 'text-teal-800 font-bold' : 'text-slate-400'
                      }`}
                    >
                      {st}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* AI Topic Script Modal */}
      <AITopicScriptModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        onSelectScript={handleSelectAiScript}
      />
    </div>
  );
};
