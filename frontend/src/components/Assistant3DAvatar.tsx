import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Volume2,
  Lightbulb,
  Clock,
  Mic,
  Activity,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  Send,
  HelpCircle,
  User,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { askCoachAI, CoachAIResponse } from '../services/api';

interface Assistant3DAvatarProps {
  isSpeaking?: boolean;
  coachMessage?: string;
  avatarState?: 'idle' | 'listening' | 'speaking' | 'celebrating' | 'coaching';
  onResetView?: () => void;
  className?: string;
}

export const Assistant3DAvatar: React.FC<Assistant3DAvatarProps> = ({
  isSpeaking = false,
  coachMessage = "Hello! I'm Alex, your SpeakSense speech coach. Ready to practice?",
  className = '',
}) => {
  const [viewMode, setViewMode] = useState<'portrait' | 'full'>('portrait');
  const [selectedTipCategory, setSelectedTipCategory] = useState<string | null>(null);
  const [activeSpeechAdvice, setActiveSpeechAdvice] = useState<string>(coachMessage);
  
  // Interactive Ask Alex AI Drawer
  const [showAskDrawer, setShowAskDrawer] = useState(false);
  const [askQuestion, setAskQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [aiCoachReply, setAiCoachReply] = useState<CoachAIResponse | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  // Sync external coachMessage changes
  useEffect(() => {
    setActiveSpeechAdvice(coachMessage);
  }, [coachMessage]);

  const flawCorrectionTips: Record<string, { title: string; advice: string; drill: string }> = {
    pacing: {
      title: 'Pacing & Speed Control',
      advice: 'If you speak too fast, listeners miss your key points. In public speaking, aim for 130 to 160 words per minute.',
      drill: 'Action drill: Count 1-2 in your head at each period. Give important words room to breathe.',
    },
    pauses: {
      title: 'Eliminating Awkward Pauses',
      advice: 'Avoid stopping in the middle of a phrase. Pauses belong only at natural punctuation (commas, colons, and periods).',
      drill: 'Action drill: Inhale before each sentence, then speak the complete thought on a single sustained breath.',
    },
    pitch: {
      title: 'Fixing Monotone Delivery',
      advice: 'Flat pitch makes speeches feel dull. Good speakers modulate their vocal pitch by 2 to 3 semitones between sentences.',
      drill: 'Action drill: Lift your pitch higher when posing questions or introducing key words, and lower your tone when concluding.',
    },
    energy: {
      title: 'Volume & Vocal Projection',
      advice: 'Lacking energy makes you sound unsure. Speak from your diaphragm, not your throat, to project cleanly.',
      drill: 'Action drill: Practice standing tall and aiming your voice toward the back wall of the room.',
    },
  };

  const handleSelectTip = (catKey: string) => {
    if (selectedTipCategory === catKey) {
      setSelectedTipCategory(null);
      setActiveSpeechAdvice(coachMessage);
    } else {
      setSelectedTipCategory(catKey);
      const tip = flawCorrectionTips[catKey];
      setActiveSpeechAdvice(`${tip.advice} ${tip.drill}`);
    }
  };

  const handleAskAlex = async (qText?: string) => {
    const query = qText || askQuestion;
    if (!query.trim()) return;
    setIsAsking(true);
    setAskError(null);
    try {
      const reply = await askCoachAI({ question: query.trim() });
      setAiCoachReply(reply);
      setActiveSpeechAdvice(reply.key_takeaway + ' ' + reply.quick_drill);
      setAskQuestion('');
    } catch (err: any) {
      setAskError(err.message || 'Failed to get advice from Alex. Please try again.');
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* 2D Coach Character & Speech Card */}
      <div className="w-full bg-gradient-to-b from-slate-50 to-white rounded-2xl border border-slate-200/90 p-5 shadow-soft-sm">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          
          {/* Authentic 3D Character Model Frame */}
          <div className="relative shrink-0 flex flex-col items-center">
            {/* Soft Ambient Audio Halo */}
            <div
              className={`rounded-full absolute -inset-1.5 transition-all duration-500 blur-md ${
                isSpeaking ? 'bg-teal-400/40 animate-pulse' : 'bg-teal-200/20'
              }`}
            />

            {/* Character Image Container */}
            <div
              className={`relative bg-gradient-to-b from-sky-50 via-teal-50 to-slate-100 border-2 border-teal-200/90 shadow-md overflow-hidden flex items-center justify-center transition-all duration-300 ${
                viewMode === 'portrait'
                  ? 'w-28 h-28 sm:w-32 sm:h-32 rounded-full'
                  : 'w-28 h-40 sm:w-32 sm:h-44 rounded-2xl'
              }`}
            >
              {viewMode === 'portrait' ? (
                <img
                  src={isSpeaking ? '/avatar/alex_speaking.png' : '/avatar/alex_front_face.png'}
                  alt="Alex - SpeakSense AI Coach"
                  className={`w-full h-full object-cover transition-transform duration-300 hover:scale-105 ${
                    isSpeaking ? 'scale-105 filter brightness-105' : ''
                  }`}
                />
              ) : (
                <img
                  src="/avatar/alex_standing_full.png"
                  alt="Alex - SpeakSense AI Coach Full Body"
                  className="w-full h-full object-contain p-1 transition-transform duration-300 hover:scale-105"
                />
              )}

              {/* Speaking Status Overlay */}
              {isSpeaking && (
                <span className="absolute bottom-1 left-1/2 transform -translate-x-1/2 inline-flex items-center gap-1 text-[9px] font-bold text-teal-900 bg-teal-100/95 border border-teal-300 px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                  <Volume2 className="w-2.5 h-2.5 text-teal-700" /> Speaking
                </span>
              )}
            </div>

            {/* View Mode Toggle Button */}
            <div className="mt-2 flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('portrait')}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${
                  viewMode === 'portrait'
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Portrait
              </button>
              <button
                type="button"
                onClick={() => setViewMode('full')}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${
                  viewMode === 'full'
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Full Stance
              </button>
            </div>
          </div>

          {/* Coach Message Bubble */}
          <div className="flex-1 w-full">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-extrabold text-slate-900 tracking-wide uppercase flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" /> Alex &bull; Speech Coach
                </span>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 rounded-md">
                  Gemini-Powered
                </span>
              </div>

              {/* Ask Alex AI Toggle */}
              <button
                type="button"
                onClick={() => setShowAskDrawer(!showAskDrawer)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                  showAskDrawer
                    ? 'bg-teal-600 text-white'
                    : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200'
                }`}
              >
                <MessageSquare className="w-3 h-3" />
                {showAskDrawer ? 'Close Advice' : 'Ask Alex AI'}
              </button>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm relative">
              <p className="text-sm text-slate-800 leading-relaxed font-normal">
                "{activeSpeechAdvice}"
              </p>
            </div>
          </div>
        </div>

        {/* Ask Alex AI Drawer */}
        {showAskDrawer && (
          <div className="mt-4 p-4 bg-teal-50/60 rounded-xl border border-teal-200 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-teal-600" /> Ask Alex Any Speech Question
              </span>
              <span className="text-[11px] text-teal-700 font-medium">Powered by Gemini 3.5</span>
            </div>

            {/* Quick Question Chips */}
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {[
                'How do I fix my monotone voice?',
                'How do I stop rushing my words?',
                'How to breathe during long sentences?',
                'What is the ideal speaking cadence?'
              ].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleAskAlex(q)}
                  disabled={isAsking}
                  className="text-[11px] px-2.5 py-1 bg-white hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-full transition-colors disabled:opacity-50 text-left"
                >
                  {q}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={askQuestion}
                onChange={(e) => setAskQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskAlex()}
                placeholder="e.g. How do I project without straining my throat?"
                disabled={isAsking}
                className="flex-1 text-xs px-3 py-2 bg-white border border-teal-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-800 placeholder-slate-400"
              />
              <button
                type="button"
                onClick={() => handleAskAlex()}
                disabled={isAsking || !askQuestion.trim()}
                className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              >
                {isAsking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Ask
              </button>
            </div>

            {askError && (
              <p className="text-xs text-rose-600 mt-2 font-medium">{askError}</p>
            )}

            {aiCoachReply && (
              <div className="mt-3 p-3 bg-white rounded-lg border border-teal-200 text-xs text-slate-800 space-y-1.5 shadow-xs">
                <div className="font-bold text-teal-900 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" /> Core Takeaway:
                </div>
                <p className="text-slate-700">{aiCoachReply.key_takeaway}</p>
                <div className="pt-2 border-t border-slate-100 font-bold text-amber-800 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-amber-600" /> Recommended Drill:
                </div>
                <p className="text-slate-600 italic">{aiCoachReply.quick_drill}</p>
              </div>
            )}
          </div>
        )}

        {/* Flaw Rectification & Coaching Tips Buttons */}
        <div className="mt-4 pt-3.5 border-t border-slate-200/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
              How to Rectify Common Delivery Flaws:
            </span>
            <span className="text-[11px] text-slate-400">Click a category for action drills</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => handleSelectTip('pacing')}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all text-left flex items-center justify-between ${
                selectedTipCategory === 'pacing'
                  ? 'bg-teal-50 text-teal-800 border-teal-300 ring-2 ring-teal-500/20'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-600" /> Pacing
              </span>
              <ChevronRight className="w-3 h-3 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => handleSelectTip('pauses')}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all text-left flex items-center justify-between ${
                selectedTipCategory === 'pauses'
                  ? 'bg-sky-50 text-sky-800 border-sky-300 ring-2 ring-sky-500/20'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-sky-600" /> Pauses
              </span>
              <ChevronRight className="w-3 h-3 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => handleSelectTip('pitch')}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all text-left flex items-center justify-between ${
                selectedTipCategory === 'pitch'
                  ? 'bg-indigo-50 text-indigo-800 border-indigo-300 ring-2 ring-indigo-500/20'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-indigo-600" /> Pitch
              </span>
              <ChevronRight className="w-3 h-3 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => handleSelectTip('energy')}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all text-left flex items-center justify-between ${
                selectedTipCategory === 'energy'
                  ? 'bg-amber-50 text-amber-800 border-amber-300 ring-2 ring-amber-500/20'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-amber-600" /> Energy
              </span>
              <ChevronRight className="w-3 h-3 text-slate-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
