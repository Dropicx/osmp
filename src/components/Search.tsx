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
        <h1 className="text-3xl font-bold mb-6">Search</h1>
        <form onSubmit={handleSearch} className="relative">
          <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for songs, artists, or albums..."
            className="w-full bg-gray-800 rounded-full pl-12 pr-6 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-white"
          />
        </form>
      </div>

      {tracks.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Results</h2>
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="text-left p-4 text-gray-400 font-normal">#</th>
                  <th className="text-left p-4 text-gray-400 font-normal">Title</th>
                  <th className="text-left p-4 text-gray-400 font-normal">Artist</th>
                  <th className="text-left p-4 text-gray-400 font-normal">Album</th>
                  <th className="text-right p-4 text-gray-400 font-normal">Duration</th>
                </tr>
              </thead>
              <tbody>
                {tracks.map((track, index) => (
                  <tr
                    key={track.id}
                    className="hover:bg-gray-700 cursor-pointer"
                    onClick={() => playTrack(track.id)}
                  >
                    <td className="p-4 text-gray-400">{index + 1}</td>
                    <td className="p-4 font-medium">{track.title || 'Unknown Title'}</td>
                    <td className="p-4 text-gray-400">{track.artist || 'Unknown Artist'}</td>
                    <td className="p-4 text-gray-400">{track.album || 'Unknown Album'}</td>
                    <td className="p-4 text-right text-gray-400">
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
        <div className="text-center text-gray-400 py-12">
          <p>No results found for "{query}"</p>
        </div>
      )}
    </div>
  );
}
