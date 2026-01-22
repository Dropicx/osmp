import { useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import { invoke } from '@tauri-apps/api/core';
import { Play, Pause, SkipBack, SkipForward, Volume2, Shuffle, Repeat, Repeat1 } from 'lucide-react';

export default function Player() {
  const {
    currentTrack,
    isPlaying,
    volume,
    position,
    shuffleEnabled,
    repeatMode,
    setVolume,
    pausePlayback,
    toggleShuffle,
    cycleRepeatMode,
    playNextTrack,
    playPreviousTrack
  } = useStore();
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPercent, setHoverPercent] = useState<number>(0);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const formatDuration = (seconds: number | null) => {
    if (seconds === null || seconds === undefined) return '0:00';
    const secs = Math.floor(seconds);
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const handlePrevious = () => {
    playPreviousTrack();
  };

  const handleNext = () => {
    playNextTrack();
  };

  const handleProgressClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentTrack?.duration || !progressBarRef.current) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = clickX / rect.width;
    const seekTime = percent * currentTrack.duration;

    try {
      await invoke('seek_to_position', { position: seekTime });
    } catch (error) {
      console.error('Failed to seek:', error);
    }
  };

  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentTrack?.duration || !progressBarRef.current) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, hoverX / rect.width));
    const time = percent * currentTrack.duration;

    setHoverTime(time);
    setHoverPercent(percent * 100);
  };

  const handleProgressLeave = () => {
    setHoverTime(null);
  };

  // Calculate progress percentage
  const progressPercent = currentTrack?.duration
    ? Math.min((position / currentTrack.duration) * 100, 100)
    : 0;

  if (!currentTrack) {
    return null;
  }

  return (
    <div className="bg-bg-elevated border-t border-bg-surface px-8 py-5 shadow-2xl">
      <div className="flex items-center justify-between gap-6">
        {/* Track Info */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-text-primary truncate">{currentTrack.title || 'Unknown Title'}</p>
            <p className="text-sm text-text-tertiary truncate">{currentTrack.artist || 'Unknown Artist'}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-1 justify-center">
          <button
            onClick={toggleShuffle}
            className={`btn-icon ${shuffleEnabled ? 'text-primary-500' : ''}`}
            title={shuffleEnabled ? "Shuffle: On" : "Shuffle: Off"}
          >
            <Shuffle size={18} className={shuffleEnabled ? 'text-primary-500' : 'text-text-secondary'} />
          </button>
          <button
            onClick={handlePrevious}
            className="btn-icon"
            title="Previous track"
          >
            <SkipBack size={20} className="text-text-secondary" />
          </button>
          <button
            onClick={pausePlayback}
            className="p-4 bg-primary-600 hover:bg-primary-700 text-white rounded-full hover:scale-110 transition-all duration-200 shadow-lg shadow-primary-600/40 flex items-center justify-center"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-0.5" />}
          </button>
          <button
            onClick={handleNext}
            className="btn-icon"
            title="Next track"
          >
            <SkipForward size={20} className="text-text-secondary" />
          </button>
          <button
            onClick={cycleRepeatMode}
            className={`btn-icon relative ${repeatMode !== 'off' ? 'text-primary-500' : ''}`}
            title={repeatMode === 'off' ? 'Repeat: Off' : repeatMode === 'list' ? 'Repeat: All' : 'Repeat: One'}
          >
            {repeatMode === 'track' ? (
              <Repeat1 size={18} className="text-primary-500" />
            ) : (
              <Repeat size={18} className={repeatMode === 'list' ? 'text-primary-500' : 'text-text-secondary'} />
            )}
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-3 flex-1 justify-end">
          <Volume2 size={18} className="text-text-tertiary" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-28 h-1.5 bg-bg-card rounded-lg appearance-none cursor-pointer accent-primary-600"
            style={{
              background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${volume * 100}%, #1f1f2e ${volume * 100}%, #1f1f2e 100%)`
            }}
          />
          <span className="text-sm text-text-tertiary w-12 text-right font-medium">
            {Math.round(volume * 100)}%
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="flex items-center gap-3 text-xs text-text-tertiary">
          <span className="w-12 text-left font-medium">{formatDuration(position)}</span>
          <div
            ref={progressBarRef}
            className="flex-1 h-1.5 bg-bg-card rounded-full overflow-visible cursor-pointer relative group"
            onClick={handleProgressClick}
            onMouseMove={handleProgressHover}
            onMouseLeave={handleProgressLeave}
          >
            {/* Progress fill */}
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all duration-100 shadow-lg shadow-primary-500/50"
              style={{ width: `${progressPercent}%` }}
            />

            {/* Hover indicator */}
            {hoverTime !== null && (
              <>
                {/* Hover line */}
                <div
                  className="absolute top-0 w-0.5 h-full bg-primary-400 opacity-60"
                  style={{ left: `${hoverPercent}%` }}
                />
                {/* Time tooltip */}
                <div
                  className="absolute -top-8 transform -translate-x-1/2 bg-bg-card text-text-primary px-3 py-1.5 rounded-lg text-xs whitespace-nowrap shadow-lg border border-bg-surface"
                  style={{ left: `${hoverPercent}%` }}
                >
                  {formatDuration(hoverTime)}
                </div>
              </>
            )}
          </div>
          <span className="w-12 text-right font-medium">{formatDuration(currentTrack.duration)}</span>
        </div>
      </div>
    </div>
  );
}
