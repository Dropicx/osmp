import { useStore } from '../store/useStore';
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';

export default function Player() {
  const { currentTrack, isPlaying, volume, setVolume, playTrack, pausePlayback, tracks } = useStore();

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePrevious = () => {
    if (!currentTrack) return;
    const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
    if (currentIndex > 0) {
      playTrack(tracks[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (!currentTrack) return;
    const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
    if (currentIndex < tracks.length - 1) {
      playTrack(tracks[currentIndex + 1].id);
    }
  };

  if (!currentTrack) {
    return null;
  }

  return (
    <div className="bg-gray-800 border-t border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Track Info */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{currentTrack.title || 'Unknown Title'}</p>
            <p className="text-sm text-gray-400 truncate">{currentTrack.artist || 'Unknown Artist'}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 flex-1 justify-center">
          <button
            onClick={handlePrevious}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            disabled={tracks.findIndex(t => t.id === currentTrack.id) === 0}
          >
            <SkipBack size={20} />
          </button>
          <button
            onClick={isPlaying ? pausePlayback : () => playTrack(currentTrack.id)}
            className="p-3 bg-white text-black rounded-full hover:scale-105 transition-transform"
          >
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>
          <button
            onClick={handleNext}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            disabled={tracks.findIndex(t => t.id === currentTrack.id) === tracks.length - 1}
          >
            <SkipForward size={20} />
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          <Volume2 size={20} className="text-gray-400" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-24"
          />
          <span className="text-sm text-gray-400 w-12 text-right">
            {Math.round(volume * 100)}%
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>0:00</span>
          <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-white" style={{ width: '0%' }}></div>
          </div>
          <span>{formatDuration(currentTrack.duration)}</span>
        </div>
      </div>
    </div>
  );
}
