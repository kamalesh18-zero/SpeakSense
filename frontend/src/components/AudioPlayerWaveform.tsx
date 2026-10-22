import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, RotateCcw, FastForward } from 'lucide-react';

interface AudioPlayerWaveformProps {
  title: string;
  subtitle?: string;
  audioUrl: string;
  duration?: number;
  highlightInterval?: { start: number; end: number } | null;
  seekTime?: number | null;
  onTimeUpdate?: (currentTime: number) => void;
  accentColor?: 'cyan' | 'teal' | 'amber';
}

export const AudioPlayerWaveform: React.FC<AudioPlayerWaveformProps> = ({
  title,
  subtitle,
  audioUrl,
  duration: initialDuration,
  highlightInterval,
  seekTime,
  onTimeUpdate,
  accentColor = 'cyan',
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Sync seekTime prop
  useEffect(() => {
    if (seekTime !== undefined && seekTime !== null && audioRef.current) {
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [seekTime]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const curr = audioRef.current.currentTime;
    setCurrentTime(curr);
    if (onTimeUpdate) {
      onTimeUpdate(curr);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const changeRate = () => {
    const rates = [1.0, 1.25, 0.75];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Accent styles
  const accentBorder = accentColor === 'teal' ? 'border-teal-500/40' : accentColor === 'amber' ? 'border-amber-500/40' : 'border-cyan-500/40';
  const accentBg = accentColor === 'teal' ? 'bg-teal-500' : accentColor === 'amber' ? 'bg-amber-500' : 'bg-cyan-500';
  const accentText = accentColor === 'teal' ? 'text-teal-400' : accentColor === 'amber' ? 'text-amber-400' : 'text-cyan-400';

  return (
    <div className={`p-4 rounded-xl bg-navy-850/90 border ${accentBorder} shadow-lg backdrop-blur-sm`}>
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-white tracking-wide">{title}</h4>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        <div className="text-xs font-mono px-2 py-0.5 rounded bg-navy-900 border border-slate-700/80 text-slate-300">
          <span className={accentText}>{formatTime(currentTime)}</span> / {formatTime(duration)}
        </div>
      </div>

      {/* Simulated Waveform & Progress Track */}
      <div className="relative w-full h-12 bg-navy-900 rounded-lg overflow-hidden border border-slate-700/60 mb-3 flex items-center px-1">
        {/* Synthetic sound wave visual bars */}
        <div className="absolute inset-0 flex items-center justify-between px-2 opacity-35 pointer-events-none">
          {Array.from({ length: 48 }).map((_, i) => {
            // Pseudo-random deterministic height
            const h = 20 + Math.sin(i * 0.4) * 15 + Math.cos(i * 0.9) * 12;
            const isPlayed = (i / 48) * 100 <= progressPercent;
            return (
              <div
                key={i}
                className={`w-1 rounded-full transition-colors duration-100 ${
                  isPlayed ? accentBg : 'bg-slate-500'
                }`}
                style={{ height: `${Math.max(12, Math.min(42, h))}px` }}
              />
            );
          })}
        </div>

        {/* Highlight Interval (Flaw Marker) */}
        {highlightInterval && duration > 0 && (
          <div
            className="absolute top-0 bottom-0 bg-rose-500/30 border-x border-rose-400 pointer-events-none z-10"
            style={{
              left: `${(highlightInterval.start / duration) * 100}%`,
              width: `${Math.max(2, ((highlightInterval.end - highlightInterval.start) / duration) * 100)}%`,
            }}
          />
        )}

        {/* Range Slider for seeking */}
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.05}
          value={currentTime}
          onChange={handleSeek}
          className="relative z-20 w-full h-full opacity-0 cursor-pointer"
        />

        {/* Playhead marker */}
        <div
          className={`absolute top-0 bottom-0 w-0.5 ${accentBg} shadow-sm shadow-cyan-400 z-15 pointer-events-none`}
          style={{ left: `${progressPercent}%` }}
        />
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between text-slate-300">
        <div className="flex items-center space-x-2">
          <button
            onClick={togglePlay}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
              isPlaying ? 'bg-rose-500 text-white' : `${accentBg} text-navy-950 font-bold hover:brightness-110`
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5 fill-current" />}
          </button>

          <button
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
                setCurrentTime(0);
              }
            }}
            className="p-2 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-300 transition-colors"
            title="Restart"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={changeRate}
            className="px-2 py-1 rounded bg-navy-800 hover:bg-navy-700 text-[11px] font-mono text-cyan-400 transition-colors"
            title="Speed"
          >
            {playbackRate}x
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <button onClick={toggleMute} className="text-slate-400 hover:text-slate-200">
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setVolume(val);
              setIsMuted(false);
              if (audioRef.current) {
                audioRef.current.volume = val;
                audioRef.current.muted = false;
              }
            }}
            className="w-16 h-1 bg-navy-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      </div>
    </div>
  );
};
