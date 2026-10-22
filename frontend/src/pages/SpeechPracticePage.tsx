import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Upload,
  Mic,
  ArrowRight,
  Sparkles,
  Info,
  CheckCircle2,
  Flame,
  Clock,
  Layers,
  FileAudio
} from 'lucide-react';
import { fetchScripts, analyzeBenchmarkSpeech } from '../services/api';
import { ScriptItem, BenchmarkAnalysisResult } from '../types';
import { AudioRecorder } from '../components/AudioRecorder';
import { Assistant3DAvatar } from '../components/Assistant3DAvatar';
import { AITopicScriptModal } from '../components/AITopicScriptModal';

interface SpeechPracticePageProps {
  onAnalysisComplete: (result: BenchmarkAnalysisResult) => void;
  onNavigateToContrastive?: () => void;
}

export const SpeechPracticePage: React.FC<SpeechPracticePageProps> = ({
  onAnalysisComplete,
  onNavigateToContrastive,
}) => {
  const [scripts, setScripts] = useState<ScriptItem[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState<string>('');
  const [customTranscript, setCustomTranscript] = useState<string>('');
  const [categoryKey, setCategoryKey] = useState<string>('public_speaking');
  const [activeInputMode, setActiveInputMode] = useState<'mic' | 'upload'>('mic');

  // Audio files
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);

  const handleSelectAiScript = (generated: { title: string; transcript: string; category: string }) => {
    setSelectedScriptId('custom');
    setCustomTranscript(generated.transcript);
    setCategoryKey(generated.category);
    setCoachAdvice(`AI generated "${generated.title}". Practice with steady breath support and observe pause boundaries!`);
  };

  // Guided TTS Coaching
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  const [currentWordIdx, setCurrentWordIdx] = useState<number>(-1);
  const [coachAdvice, setCoachAdvice] = useState<string>(
    "Welcome! Choose a speech category and practice reading aloud. I'll listen and evaluate your pacing, pauses, and pitch!"
  );

  const ttsUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load sample scripts
  useEffect(() => {
    fetchScripts()
      .then((data) => {
        setScripts(data);
        if (data.length > 0) {
          setSelectedScriptId(data[0].id);
          setCustomTranscript(data[0].transcript);
        }
      })
      .catch((err) => console.error('Failed to load scripts', err));
  }, []);

  // Update transcript when script selection changes
  const handleScriptChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sId = e.target.value;
    setSelectedScriptId(sId);
    stopTtsPlayback();
    if (sId === 'custom') {
      setCustomTranscript('');
      setCoachAdvice("You've selected custom text. Enter your speech or script below and hit record!");
    } else {
      const found = scripts.find((s) => s.id === sId);
      if (found) {
        setCustomTranscript(found.transcript);
        setCoachAdvice(`Practicing "${found.title}". Take a deep breath, pace yourself, and speak clearly into your mic!`);
      }
    }
  };

  // Guided Text-to-Speech playback with word tracking & coaching markers
  const startTtsPlayback = () => {
    if (!('speechSynthesis' in window)) {
      alert('Text-to-speech is not supported in this browser.');
      return;
    }

    if (!customTranscript || customTranscript.trim().length === 0) {
      alert('Please enter or select a script first.');
      return;
    }

    window.speechSynthesis.cancel();
    const words = customTranscript.trim().split(/\s+/);

    const utterance = new SpeechSynthesisUtterance(customTranscript);
    ttsUtteranceRef.current = utterance;
    utterance.rate = 0.92; // Slightly measured pace for coaching
    utterance.pitch = 1.0;

    // Pick natural English voice if available
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(
      (v) => (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Guy')) && v.lang.startsWith('en')
    );
    if (naturalVoice) utterance.voice = naturalVoice;

    let wordCharCount = 0;
    const charOffsets = words.map((w) => {
      const start = wordCharCount;
      wordCharCount += w.length + 1;
      return start;
    });

    utterance.onboundary = (e) => {
      if (e.name === 'word') {
        const charIndex = e.charIndex;
        // Find matching word index
        const idx = charOffsets.findIndex((offset, i) => {
          const nextOffset = charOffsets[i + 1] || Infinity;
          return charIndex >= offset && charIndex < nextOffset;
        });
        if (idx !== -1) {
          setCurrentWordIdx(idx);
        }
      }
    };

    utterance.onstart = () => {
      setIsTtsPlaying(true);
      setCoachAdvice("Listening to guided model delivery. Notice where natural pauses and emphasis fall!");
    };

    utterance.onend = () => {
      setIsTtsPlaying(false);
      setCurrentWordIdx(-1);
      setCoachAdvice("Model speech completed! Now it's your turn. Press 'Start Recording' when ready.");
    };

    utterance.onerror = () => {
      setIsTtsPlaying(false);
      setCurrentWordIdx(-1);
    };

    window.speechSynthesis.speak(utterance);
  };

  const stopTtsPlayback = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsTtsPlaying(false);
    setCurrentWordIdx(-1);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
      setRecordedBlob(null);
      setCoachAdvice(`Loaded audio file "${e.target.files[0].name}". Click 'Analyze My Speech' to get your score!`);
    }
  };

  const handleRunAnalysis = async () => {
    setErrorMessage(null);
    const audioPayload = activeInputMode === 'mic' ? recordedBlob : uploadedFile;

    if (!audioPayload) {
      setErrorMessage(
        activeInputMode === 'mic'
          ? 'Please record your speech first before analyzing.'
          : 'Please select an audio file (WAV, MP3, or M4A) to analyze.'
      );
      return;
    }

    if (!customTranscript || customTranscript.trim().split(/\s+/).length < 3) {
      setErrorMessage('A script or transcript of at least 3 words is required for benchmark alignment.');
      return;
    }

    try {
      setIsAnalyzing(true);
      setCoachAdvice("Analyzing your acoustic signal: calculating effective WPM, pause intervals, pitch variation, and clarity...");
      const result = await analyzeBenchmarkSpeech({
        audioFile: audioPayload,
        categoryKey,
        transcript: customTranscript,
        scriptId: selectedScriptId !== 'custom' ? selectedScriptId : undefined,
      });

      setIsAnalyzing(false);
      onAnalysisComplete(result);
    } catch (err: any) {
      setIsAnalyzing(false);
      setErrorMessage(err.message || 'Speech analysis failed. Please try again.');
      setCoachAdvice("Hmm, something went wrong with the audio processing. Check your mic and try again.");
    }
  };

  // Render annotated words
  const words = customTranscript.trim().split(/\s+/);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Top Banner */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
          <Sparkles className="w-3.5 h-3.5" /> AI Speech Coaching & Benchmark Engine
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Speech Practice & Live Evaluator
        </h1>
        <p className="text-base text-slate-600 max-w-3xl mt-1">
          Practice standard orations, listen to guided phrasing with the 3D coach, and receive instant rubric scoring
          grounded in real acoustic signal processing.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Script Practice & Guided Speech (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Category & Script Selector */}
          <div className="white-card p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-teal-600" /> 1. Select Benchmark Category & Script
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Speaking Category
                </label>
                <select
                  value={categoryKey}
                  onChange={(e) => setCategoryKey(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="public_speaking">Public Speaking (130-160 WPM)</option>
                  <option value="persuasive_oratory">Persuasive Oratory (125-155 WPM)</option>
                  <option value="declamation">Declamation (115-145 WPM)</option>
                  <option value="interpretive_reading">Interpretive Reading (110-140 WPM)</option>
                  <option value="extemporaneous">Extemporaneous (135-165 WPM)</option>
                  <option value="debate">Debate (160-210 WPM)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Practice Script
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAiModal(true)}
                    className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-lg transition-colors border border-teal-200"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                    <span>Generate with Gemini AI</span>
                  </button>
                </div>
                <select
                  value={selectedScriptId}
                  onChange={handleScriptChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {scripts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.target_duration_sec}s)
                    </option>
                  ))}
                  <option value="custom">+ Use My Own Custom Text</option>
                </select>
              </div>
            </div>

            {/* Script Text Box / Spoken Word Tracker */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  Practice Script & Spoken Word Highlight
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {words.length} words &bull; ~{Math.round((words.length / 140) * 60)}s target
                </span>
              </div>

              {/* Text display with live word highlighting */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 min-h-[140px] max-h-56 overflow-y-auto leading-relaxed text-base text-slate-800">
                {words.map((word, i) => {
                  const isCurrent = i === currentWordIdx;
                  return (
                    <span
                      key={i}
                      className={`inline-block mr-1.5 my-0.5 px-1 py-0.5 rounded transition-all duration-150 ${
                        isCurrent
                          ? 'bg-teal-500 text-white font-semibold scale-105 shadow-sm'
                          : 'text-slate-800'
                      }`}
                    >
                      {word}
                    </span>
                  );
                })}
              </div>

              {selectedScriptId === 'custom' && (
                <textarea
                  value={customTranscript}
                  onChange={(e) => setCustomTranscript(e.target.value)}
                  placeholder="Paste or type your practice speech text here..."
                  rows={4}
                  className="w-full mt-3 p-3 text-sm bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              )}

              {/* Guided Audio TTS Bar */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 p-3 bg-teal-50/70 rounded-xl border border-teal-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-teal-900">Coach Guidance:</span>
                  <span className="text-xs text-teal-700">Listen to proper model cadence and pauses</span>
                </div>

                <div className="flex items-center gap-2">
                  {!isTtsPlaying ? (
                    <button
                      type="button"
                      onClick={startTtsPlayback}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-teal-800 bg-teal-200/80 hover:bg-teal-300 rounded-lg transition-colors"
                    >
                      <Volume2 className="w-4 h-4" /> Listen to Guided Speech
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopTtsPlayback}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-rose-800 bg-rose-100 hover:bg-rose-200 rounded-lg transition-colors"
                    >
                      <VolumeX className="w-4 h-4" /> Stop Guided Audio
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Audio Input Tabs: In-App Mic vs Upload */}
          <div className="white-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Mic className="w-5 h-5 text-teal-600" /> 2. Record or Upload Your Delivery
              </h2>

              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveInputMode('mic')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeInputMode === 'mic'
                      ? 'bg-white text-teal-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" /> Microphone
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInputMode('upload')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeInputMode === 'upload'
                      ? 'bg-white text-teal-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" /> Upload File
                </button>
              </div>
            </div>

            {activeInputMode === 'mic' ? (
              <AudioRecorder
                onRecordingComplete={(blob) => {
                  setRecordedBlob(blob);
                  setUploadedFile(null);
                  setCoachAdvice("Awesome recording! When you're ready, click 'Analyze My Delivery' below.");
                }}
                onRecordingClear={() => {
                  setRecordedBlob(null);
                }}
              />
            ) : (
              <div className="border-2 border-dashed border-slate-300 hover:border-teal-400 rounded-2xl p-8 text-center transition-colors bg-slate-50">
                <FileAudio className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-slate-800 mb-1">
                  {uploadedFile ? uploadedFile.name : 'Choose an audio file to evaluate'}
                </h4>
                <p className="text-xs text-slate-500 mb-4">
                  Supports WAV, MP3, M4A, WEBM, and OGG formats
                </p>
                <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl cursor-pointer shadow-sm transition-all">
                  <Upload className="w-4 h-4 text-slate-500" /> Browse Audio Files
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {/* Error banner if any */}
            {errorMessage && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
                {errorMessage}
              </div>
            )}

            {/* Submit Action Button */}
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                Deterministic 100-pt benchmark evaluation &bull; Zero fake scores
              </div>

              <button
                type="button"
                onClick={handleRunAnalysis}
                disabled={isAnalyzing || (!recordedBlob && !uploadedFile)}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl font-bold text-base shadow-soft-teal transition-all ${
                  isAnalyzing || (!recordedBlob && !uploadedFile)
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                    : 'bg-teal-600 hover:bg-teal-700 text-white'
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Extracting Acoustic Features...
                  </>
                ) : (
                  <>
                    Analyze My Delivery <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: 3D Virtual Coach (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="white-card p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600" /> Interactive Speech Coach
              </h3>
              <span className="text-xs font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                Live Companion
              </span>
            </div>

            {/* 2D Model with real-time lip sync & flaw advice */}
            <Assistant3DAvatar
              isSpeaking={isTtsPlaying}
              coachMessage={coachAdvice}
              className="mt-2"
            />
          </div>

          {/* Practice Tips Card */}
          <div className="white-card p-5 bg-gradient-to-br from-teal-50/50 to-sky-50/50 border-teal-100">
            <h4 className="text-sm font-bold text-slate-800 mb-2.5 flex items-center gap-2">
              <Info className="w-4 h-4 text-teal-600" /> Tips for High Scores
            </h4>
            <ul className="text-xs text-slate-600 space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                <span><strong>Natural Pacing:</strong> Target 130–160 WPM for public speaking. Avoid rushing through sentences.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                <span><strong>Intentional Pauses:</strong> Insert 0.4s to 1.8s breath pauses at punctuation commas and periods.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                <span><strong>Vocal Pitch:</strong> Keep pitch lively (above 1.5 semitones std dev) so delivery never sounds monotonous.</span>
              </li>
            </ul>

            {onNavigateToContrastive && (
              <div className="mt-4 pt-3 border-t border-teal-100/80 text-center">
                <button
                  type="button"
                  onClick={onNavigateToContrastive}
                  className="text-xs font-semibold text-teal-700 hover:text-teal-900 underline inline-flex items-center gap-1"
                >
                  <Layers className="w-3 h-3" /> Have a benchmark reference audio? Switch to Advanced Comparison
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Topic Script Generator Modal */}
      <AITopicScriptModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        onSelectScript={handleSelectAiScript}
      />
    </div>
  );
};
