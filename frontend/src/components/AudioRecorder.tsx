import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, RotateCcw, Check, Volume2 } from 'lucide-react';

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, audioUrl: string) => void;
  onRecordingClear?: () => void;
  maxDurationSec?: number;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onRecordingComplete,
  onRecordingClear,
  maxDurationSec = 300,
}) => {
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused' | 'recorded'>('idle');
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Clean up
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, []);

  const startLevelMeter = (stream: MediaStream) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        // Normalize 0 to 1
        setAudioLevel(Math.min(1, avg / 90));
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch {
      // AudioContext optional fallback
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        setRecordingState('recorded');
        onRecordingComplete(blob, url);

        // Stop all audio tracks
        stream.getTracks().forEach((track) => track.stop());
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(() => {});
        }
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        setAudioLevel(0);
      };

      mediaRecorder.start(250);
      setRecordingState('recording');
      setDuration(0);

      startLevelMeter(stream);

      timerRef.current = window.setInterval(() => {
        setDuration((prev) => {
          if (prev >= maxDurationSec) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      alert('Microphone access denied or not available. Please allow microphone permissions to record.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingState('paused');
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingState('recording');
      timerRef.current = window.setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resetRecording = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setRecordingState('idle');
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setIsPlayingPreview(false);
    setPreviewProgress(0);
    setAudioLevel(0);
    if (onRecordingClear) onRecordingClear();
  };

  const togglePreviewPlay = () => {
    if (!audioUrl) return;
    if (!previewAudioRef.current) {
      const audio = new Audio(audioUrl);
      previewAudioRef.current = audio;

      audio.ontimeupdate = () => {
        if (audio.duration) {
          setPreviewProgress(audio.currentTime / audio.duration);
        }
      };

      audio.onended = () => {
        setIsPlayingPreview(false);
        setPreviewProgress(0);
      };
    }

    if (isPlayingPreview) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      previewAudioRef.current.play();
      setIsPlayingPreview(true);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="white-card p-6 border border-slate-200">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Mic className="w-5 h-5 text-teal-600" /> Speak Directly Into Microphone
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Record your speech in real-time. You can pause, review, and re-record anytime before analyzing.
          </p>
        </div>

        {/* Timer Display */}
        <div className="px-4 py-2 bg-slate-100 rounded-xl border border-slate-200 text-center shrink-0">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">Duration</span>
          <span className="text-2xl font-bold font-mono text-slate-900">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Live Audio Level Meter */}
      {(recordingState === 'recording' || recordingState === 'paused') && (
        <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600 mb-2">
            <span className="flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-teal-600 animate-pulse" />
              Live Microphone Level
            </span>
            <span>{Math.round(audioLevel * 100)}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden flex">
            <div
              className={`h-full transition-all duration-75 rounded-full ${
                audioLevel > 0.85
                  ? 'bg-rose-500'
                  : audioLevel > 0.6
                  ? 'bg-amber-500'
                  : 'bg-teal-500'
              }`}
              style={{ width: `${Math.max(4, audioLevel * 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Keep the level in the green zone. If it hits red, speak slightly further from your mic.
          </p>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        {recordingState === 'idle' && (
          <button
            type="button"
            onClick={startRecording}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-6 py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold shadow-soft-teal transition-all text-base"
          >
            <Mic className="w-5 h-5 animate-pulse" /> Start Recording
          </button>
        )}

        {recordingState === 'recording' && (
          <>
            <button
              type="button"
              onClick={pauseRecording}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 rounded-xl font-medium transition-colors text-sm"
            >
              <Pause className="w-4 h-4" /> Pause
            </button>
            <button
              type="button"
              onClick={stopRecording}
              className="flex-1 flex items-center justify-center gap-2.5 px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold shadow-soft-sm transition-colors text-base"
            >
              <Square className="w-5 h-5 fill-current" /> Stop & Review
            </button>
          </>
        )}

        {recordingState === 'paused' && (
          <>
            <button
              type="button"
              onClick={resumeRecording}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold transition-colors text-sm"
            >
              <Play className="w-4 h-4 fill-current" /> Resume
            </button>
            <button
              type="button"
              onClick={stopRecording}
              className="flex-1 flex items-center justify-center gap-2.5 px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-semibold transition-colors text-base"
            >
              <Square className="w-5 h-5 fill-current" /> Finish Recording
            </button>
          </>
        )}

        {recordingState === 'recorded' && (
          <div className="w-full flex flex-col sm:flex-row items-center gap-3 bg-teal-50/70 p-4 rounded-xl border border-teal-200">
            <div className="flex items-center gap-3 flex-1 w-full">
              <button
                type="button"
                onClick={togglePreviewPlay}
                className="w-12 h-12 flex items-center justify-center bg-teal-600 hover:bg-teal-700 text-white rounded-full shrink-0 shadow-soft-teal transition-all"
                title={isPlayingPreview ? 'Pause' : 'Play Preview'}
              >
                {isPlayingPreview ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </button>

              <div className="flex-1">
                <div className="flex items-center justify-between text-xs font-semibold text-teal-900 mb-1">
                  <span>Audio Recorded Successfully</span>
                  <span>{formatTime(duration)}</span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-teal-200/60 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-teal-600 rounded-full transition-all duration-100"
                    style={{ width: `${previewProgress * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={resetRecording}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Re-record
              </button>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 bg-teal-100 px-3 py-1.5 rounded-lg">
                <Check className="w-4 h-4 text-teal-600" /> Ready to Analyze
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
