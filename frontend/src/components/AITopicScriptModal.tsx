import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Clock,
  BookOpen,
  Volume2,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight,
  Lightbulb
} from 'lucide-react';
import { generateSpeechScriptAI, GeneratedSpeechScript } from '../services/api';

interface AITopicScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectScript: (script: { title: string; transcript: string; category: string }) => void;
}

export const AITopicScriptModal: React.FC<AITopicScriptModalProps> = ({
  isOpen,
  onClose,
  onSelectScript,
}) => {
  const [topic, setTopic] = useState('');
  const [category, setCategory] = useState('persuasive_oratory');
  const [duration, setDuration] = useState(45);
  const [tone, setTone] = useState('inspiring');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedResult, setGeneratedResult] = useState<GeneratedSpeechScript | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const sampleTopics = [
    'How artificial intelligence changes human connection',
    'The urgent moral duty of environmental stewardship',
    'Overcoming imposter syndrome and finding your voice',
    'Why failure is the greatest catalyst for leadership'
  ];

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const res = await generateSpeechScriptAI({
        topic: topic.trim(),
        category,
        duration_seconds: duration,
        tone
      });
      setGeneratedResult(res);
    } catch (err: any) {
      setError(err.message || 'Generation failed. Please check your network or try a different topic.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (generatedResult?.transcript) {
      navigator.clipboard.writeText(generatedResult.transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleUseScript = () => {
    if (generatedResult) {
      onSelectScript({
        title: generatedResult.title,
        transcript: generatedResult.transcript,
        category: generatedResult.category
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-teal-50/60 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                AI Speech Script Generator
              </h3>
              <p className="text-xs text-slate-500">
                Powered by Google Gemini &bull; Tailored for oratorical competitions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Topic Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Speech Topic or Prompt
            </label>
            <textarea
              rows={2}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. The ethical responsibility of technology creators in the era of automated intelligence..."
              className="w-full text-xs sm:text-sm p-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 placeholder-slate-400"
            />
            
            {/* Quick Inspiration Pills */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400 self-center">Try:</span>
              {sampleTopics.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTopic(t)}
                  className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-600 border border-slate-200 transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 text-slate-800 font-medium"
              >
                <option value="persuasive_oratory">Persuasive Oratory</option>
                <option value="declamation">Declamation</option>
                <option value="extemporaneous">Extemporaneous</option>
                <option value="interpretive_reading">Interpretive Reading</option>
                <option value="impromptu">Impromptu</option>
              </select>
            </div>

            {/* Target Duration */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Target Duration
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 text-slate-800 font-medium"
              >
                <option value={30}>~30 seconds (Quick drill)</option>
                <option value={45}>~45 seconds (Standard)</option>
                <option value={60}>~60 seconds (1 minute)</option>
                <option value={90}>~90 seconds (Extended)</option>
              </select>
            </div>

            {/* Tone */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Vocal Tone
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 text-slate-800 font-medium"
              >
                <option value="inspiring">Inspiring & Uplifting</option>
                <option value="urgent">Urgent & Passionate</option>
                <option value="analytical">Analytical & Authoritative</option>
                <option value="dramatic">Dramatic & Expressive</option>
                <option value="conversational">Warm & Conversational</option>
              </select>
            </div>
          </div>

          {/* Generate Button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !topic.trim()}
            className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-soft-teal transition-all flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Crafting Speech with Gemini AI...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Competition Speech
              </>
            )}
          </button>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          {/* Generated Result Preview */}
          {generatedResult && (
            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    {generatedResult.title}
                  </h4>
                  <p className="text-[11px] text-teal-700 font-semibold">
                    ~{generatedResult.estimated_duration_sec}s duration &bull; {generatedResult.estimated_wpm} target WPM
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg flex items-center gap-1"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-teal-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {/* Transcript Box */}
              <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-800 leading-relaxed max-h-48 overflow-y-auto font-serif">
                {generatedResult.transcript}
              </div>

              {/* Pause & Emphasis Advice */}
              {generatedResult.pause_markers?.length > 0 && (
                <div className="text-xs text-slate-600 space-y-1">
                  <div className="font-bold text-slate-700 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-teal-600" /> Planned Breath Pauses:
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-slate-600 pl-1">
                    {generatedResult.pause_markers.map((pm, idx) => (
                      <li key={idx}>{pm}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Vocal Tips */}
              {generatedResult.coaching_tips?.length > 0 && (
                <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-200">
                  <div className="font-bold text-slate-700 flex items-center gap-1">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" /> Gemini Delivery Coaching:
                  </div>
                  <ul className="text-[11px] text-slate-600 space-y-0.5 pl-1">
                    {generatedResult.coaching_tips.map((tip, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-teal-600 font-bold">&bull;</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {generatedResult && (
          <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleUseScript}
              className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-soft-teal flex items-center gap-1.5"
            >
              <span>Use This Speech</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
