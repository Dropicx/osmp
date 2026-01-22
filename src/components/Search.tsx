import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Search as SearchIcon } from 'lucide-react';

export default function Search() {
  const { tracks, searchTracks, playTrack } = useStore();
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      searchTracks(query);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-6 text-text-primary">Search</h1>
        <form onSubmit={handleSearch} className="relative">
          <SearchIcon className="absolute left-5 top-1/2 transform -translate-y-1/2 text-text-tertiary" size={20} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for songs, artists, or albums..."
            className="w-full bg-bg-card border border-bg-surface rounded-full pl-14 pr-6 py-4 text-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
          />
        </form>
      </div>

      {tracks.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 text-text-primary">Results</h2>
          <div className="bg-bg-card rounded-2xl overflow-hidden border border-bg-surface shadow-lg">
            <table className="w-full">
              <thead className="bg-bg-elevated border-b border-bg-surface">
                <tr>
                  <th className="text-left p-4 text-text-tertiary font-medium text-sm">#</th>
                  <th className="text-left p-4 text-text-tertiary font-medium text-sm">Title</th>
                  <th className="text-left p-4 text-text-tertiary font-medium text-sm">Artist</th>
                  <th className="text-left p-4 text-text-tertiary font-medium text-sm">Album</th>
                  <th className="text-right p-4 text-text-tertiary font-medium text-sm">Duration</th>
                </tr>
              </thead>
              <tbody>
                {tracks.map((track, index) => (
                  <tr
                    key={track.id}
                    className="hover:bg-bg-hover cursor-pointer transition-colors"
                    onClick={() => playTrack(track.id)}
                  >
                    <td className="p-4 text-text-tertiary">{index + 1}</td>
                    <td className="p-4 font-semibold text-text-primary">{track.title || 'Unknown Title'}</td>
                    <td className="p-4 text-text-secondary">{track.artist || 'Unknown Artist'}</td>
                    <td className="p-4 text-text-secondary">{track.album || 'Unknown Album'}</td>
                    <td className="p-4 text-right text-text-tertiary font-medium">
                      {formatDuration(track.duration)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {query && tracks.length === 0 && (
        <div className="text-center text-text-tertiary py-12">
          <p className="text-lg">No results found for "{query}"</p>
        </div>
      )}
    </div>
  );
}
