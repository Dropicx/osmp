import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { usePosition, usePlayerState, usePlayerControls, useQueueState } from '../store/selectors';
import { invoke } from '@tauri-apps/api/core';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Shuffle,
  Repeat,
  Repeat1,
  MoreVertical,
  Pencil,
  Download,
  Image,
  Music2,
  Trash2,
  List,
  Gauge,
} from 'lucide-react';
import EditMetadataModal from './EditMetadataModal';
import AddToPlaylistMenu from './AddToPlaylistMenu';
import QueuePanel from './QueuePanel';
import { formatDuration } from '../utils/formatting';
import { DEFAULT_TITLE, DEFAULT_ARTIST } from '../constants';
import type { Track, MetadataResult, CoverFetchResult } from '../types';

export default function Player() {
  const position = usePosition();
  const { currentTrack, isPlaying, volume, shuffleEnabled, repeatMode } = usePlayerState();
  const playbackSpeed = useStore((s) => s.playbackSpeed);
  const setPlaybackSpeed = useStore((s) => s.setPlaybackSpeed);
  const {
    pausePlayback,
    playNextTrack,
    playPreviousTrack,
    setVolume,
    toggleShuffle,
    cycleRepeatMode,
  } = usePlayerControls();
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const { queue, toggleQueuePanel } = useQueueState();
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPercent, setHoverPercent] = useState<number>(0);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [addToPlaylistOpen, setAddToPlaylistOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [fetchingCovers, setFetchingCovers] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        menuBtnRef.current &&
        !menuBtnRef.current.contains(e.target as Node)
      ) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  const handleMenuToggle = () => {
    if (!showMenu && menuBtnRef.current) {
      const rect = menuBtnRef.current.getBoundingClientRect();
      setMenuPosition({ x: rect.left, y: rect.top - 8 });
    }
    setShowMenu(!showMenu);
  };

  const handleFetchMetadata = async () => {
    if (!currentTrack) return;
    setShowMenu(false);
    setFetchingMetadata(true);
    try {
      await invoke<MetadataResult[]>('fetch_metadata', {
        trackIds: [currentTrack.id],
        force: false,
      });
      await useStore.getState().refreshCurrentTrack();
      await useStore.getState().loadAlbums(true);
    } catch {
      // Error handled silently
    } finally {
      setFetchingMetadata(false);
    }
  };

  const handleFetchCovers = async () => {
    if (!currentTrack) return;
    setShowMenu(false);
    setFetchingCovers(true);
    try {
      await invoke<CoverFetchResult[]>('fetch_covers', { trackIds: [currentTrack.id] });
      await useStore.getState().refreshCurrentTrack();
      await useStore.getState().loadAlbums(true);
    } catch {
      // Error handled silently
    } finally {
      setFetchingCovers(false);
    }
  };

  const handleDelete = async () => {
    if (!currentTrack) return;
    setShowMenu(false);
    try {
      await invoke('delete_track', { trackId: currentTrack.id });
      useStore.getState().stopPlayback();
      await useStore.getState().loadTracks(true);
      await useStore.getState().loadAlbums(true);
    } catch {
      // Error handled silently
    }
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
    } catch {
      // Error handled silently
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
      {/* Screen reader announcement for now playing */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        Now playing: {currentTrack.title || 'Unknown Title'} by{' '}
        {currentTrack.artist || 'Unknown Artist'}
      </div>
      <div className="flex items-center justify-between gap-6">
        {/* Track Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            ref={menuBtnRef}
            onClick={handleMenuToggle}
            className="btn-icon flex-shrink-0"
            title="Track options"
            aria-label="Track options"
            aria-expanded={showMenu}
            aria-haspopup="menu"
          >
            <MoreVertical size={20} className="text-text-secondary" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-text-primary truncate">
              {currentTrack.title || DEFAULT_TITLE}
            </p>
            <p className="text-sm text-text-tertiary truncate">
              {currentTrack.artist || DEFAULT_ARTIST}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-1 justify-center">
          <button
            onClick={toggleShuffle}
            className={`btn-icon ${shuffleEnabled ? 'text-primary-500' : ''}`}
            title={shuffleEnabled ? 'Shuffle: On' : 'Shuffle: Off'}
            aria-label={shuffleEnabled ? 'Shuffle: On' : 'Shuffle: Off'}
            aria-pressed={shuffleEnabled}
          >
            <Shuffle
              size={18}
              className={shuffleEnabled ? 'text-primary-500' : 'text-text-secondary'}
              aria-hidden="true"
            />
          </button>
          <button
            onClick={handlePrevious}
            className="btn-icon"
            title="Previous track"
            aria-label="Previous track"
          >
            <SkipBack size={20} className="text-text-secondary" aria-hidden="true" />
          </button>
          <button
            onClick={pausePlayback}
            className="p-4 bg-primary-600 hover:bg-primary-700 text-white rounded-full hover:scale-110 transition-all duration-200 shadow-lg shadow-primary-600/40 flex items-center justify-center"
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause size={24} fill="currentColor" />
            ) : (
              <Play size={24} fill="currentColor" className="ml-0.5" />
            )}
          </button>
          <button
            onClick={handleNext}
            className="btn-icon"
            title="Next track"
            aria-label="Next track"
          >
            <SkipForward size={20} className="text-text-secondary" aria-hidden="true" />
          </button>
          <button
            onClick={cycleRepeatMode}
            className={`btn-icon relative ${repeatMode !== 'off' ? 'text-primary-500' : ''}`}
            title={
              repeatMode === 'off'
                ? 'Repeat: Off'
                : repeatMode === 'list'
                  ? 'Repeat: All'
                  : 'Repeat: One'
            }
            aria-label={
              repeatMode === 'off'
                ? 'Repeat: Off'
                : repeatMode === 'list'
                  ? 'Repeat: All'
                  : 'Repeat: One'
            }
            aria-pressed={repeatMode !== 'off'}
          >
            {repeatMode === 'track' ? (
              <Repeat1 size={18} className="text-primary-500" aria-hidden="true" />
            ) : (
              <Repeat
                size={18}
                className={repeatMode === 'list' ? 'text-primary-500' : 'text-text-secondary'}
                aria-hidden="true"
              />
            )}
          </button>
          <div className="relative">
            <button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className={`btn-icon text-xs font-semibold ${playbackSpeed !== 1.0 ? 'text-primary-500' : 'text-text-secondary'}`}
              title={`Playback speed: ${playbackSpeed}x`}
              aria-label={`Playback speed: ${playbackSpeed}x`}
              aria-expanded={showSpeedMenu}
              aria-haspopup="menu"
            >
              <Gauge size={16} aria-hidden="true" />
            </button>
            {showSpeedMenu && (
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-bg-card border border-bg-surface rounded-lg shadow-xl py-1 min-w-[80px] z-50"
                role="menu"
                aria-label="Playback speed options"
              >
                {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => {
                      setPlaybackSpeed(speed);
                      setShowSpeedMenu(false);
                    }}
                    className={`w-full px-3 py-1.5 text-sm text-center transition-colors ${
                      playbackSpeed === speed
                        ? 'text-primary-500 bg-primary-500/10'
                        : 'text-text-primary hover:bg-bg-hover'
                    }`}
                    role="menuitem"
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Volume and Queue */}
        <div className="flex items-center gap-3 flex-1 justify-end">
          <button
            onClick={toggleQueuePanel}
            className="btn-icon relative"
            title="Queue"
            aria-label={`Queue${queue.length > 0 ? ` (${queue.length} tracks)` : ''}`}
          >
            <List size={18} className="text-text-secondary" />
            {queue.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                {queue.length}
              </span>
            )}
          </button>
          <Volume2 size={18} className="text-text-tertiary" aria-hidden="true" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            aria-label="Volume"
            className="w-28 h-1.5 bg-bg-card rounded-lg appearance-none cursor-pointer accent-primary-600"
            style={{
              background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${volume * 100}%, #1f1f2e ${volume * 100}%, #1f1f2e 100%)`,
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
            role="slider"
            tabIndex={0}
            aria-label="Playback progress"
            aria-valuenow={Math.floor(position)}
            aria-valuemin={0}
            aria-valuemax={currentTrack?.duration || 0}
            onKeyDown={async (e) => {
              if (!currentTrack?.duration) return;
              let seekTime: number | null = null;
              if (e.key === 'ArrowRight') seekTime = Math.min(position + 5, currentTrack.duration);
              else if (e.key === 'ArrowLeft') seekTime = Math.max(position - 5, 0);
              if (seekTime !== null) {
                e.preventDefault();
                try {
                  await invoke('seek_to_position', { position: seekTime });
                } catch {
                  /* handled */
                }
              }
            }}
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
          <span className="w-12 text-right font-medium">
            {formatDuration(currentTrack.duration)}
          </span>
        </div>
      </div>

      {/* Track Options Menu */}
      {showMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-bg-card border border-bg-surface rounded-xl shadow-2xl py-2 min-w-[180px]"
          style={{ left: menuPosition.x, top: menuPosition.y, transform: 'translateY(-100%)' }}
          role="menu"
          aria-label="Track options menu"
        >
          <button
            onClick={() => {
              setEditingTrack(currentTrack);
              setShowMenu(false);
            }}
            className="w-full px-4 py-2 text-left text-text-primary hover:bg-bg-hover flex items-center gap-3 transition-colors"
          >
            <Pencil size={16} className="text-blue-400" />
            Edit Metadata
          </button>
          <div className="h-px bg-bg-surface my-1" />
          <button
            onClick={handleFetchMetadata}
            disabled={fetchingMetadata}
            className="w-full px-4 py-2 text-left text-text-primary hover:bg-bg-hover flex items-center gap-3 transition-colors disabled:opacity-50"
          >
            <Download size={16} className="text-green-400" />
            {fetchingMetadata ? 'Fetching...' : 'Fetch Metadata'}
          </button>
          <button
            onClick={handleFetchCovers}
            disabled={fetchingCovers}
            className="w-full px-4 py-2 text-left text-text-primary hover:bg-bg-hover flex items-center gap-3 transition-colors disabled:opacity-50"
          >
            <Image size={16} className="text-purple-400" />
            {fetchingCovers ? 'Fetching...' : 'Fetch Covers'}
          </button>
          <div className="h-px bg-bg-surface my-1" />
          <button
            onClick={() => {
              setAddToPlaylistOpen(true);
              setShowMenu(false);
            }}
            className="w-full px-4 py-2 text-left text-text-primary hover:bg-bg-hover flex items-center gap-3 transition-colors"
          >
            <Music2 size={16} className="text-primary-500" />
            Add to Playlist
          </button>
          <div className="h-px bg-bg-surface my-1" />
          <button
            onClick={handleDelete}
            className="w-full px-4 py-2 text-left text-red-400 hover:bg-bg-hover flex items-center gap-3 transition-colors"
          >
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      )}

      {/* Edit Metadata Modal */}
      {editingTrack && (
        <EditMetadataModal
          track={editingTrack}
          onClose={() => setEditingTrack(null)}
          onSaved={async () => {
            setEditingTrack(null);
            await useStore.getState().refreshCurrentTrack();
            await useStore.getState().loadAlbums(true);
          }}
        />
      )}

      {/* Add to Playlist Menu */}
      {currentTrack && (
        <AddToPlaylistMenu
          trackId={currentTrack.id}
          isOpen={addToPlaylistOpen}
          onClose={() => setAddToPlaylistOpen(false)}
          position={menuPosition}
        />
      )}

      {/* Queue Panel */}
      <QueuePanel />
    </div>
  );
}
