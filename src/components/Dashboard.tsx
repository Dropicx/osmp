import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Play, Music } from 'lucide-react';

export default function Dashboard() {
  const { tracks, loadTracks, playTrack } = useStore();

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  const recentlyAdded = tracks
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, 12);

  // Simple recommendation: group by genre and artist
  const recommendations = tracks
    .filter(t => t.genre && t.artist)
    .reduce((acc, track) => {
      const key = `${track.genre}-${track.artist}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      if (acc[key].length < 6) {
        acc[key].push(track);
      }
      return acc;
    }, {} as Record<string, typeof tracks>);

  const recommendationGroups = Object.values(recommendations).slice(0, 3);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Good evening</h1>
        <p className="text-gray-400">Welcome back to OSMP</p>
      </div>

      {tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
          <Music size={64} className="mb-4 opacity-50" />
          <p className="text-lg">No music found</p>
          <p className="text-sm mt-2">Add scan folders in Settings to get started</p>
        </div>
      ) : (
        <>
          <section>
            <h2 className="text-2xl font-bold mb-4">Recently Added</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {recentlyAdded.map((track) => (
                <div
                  key={track.id}
                  className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors cursor-pointer group"
                  onClick={() => playTrack(track.id)}
                >
                  <div className="aspect-square bg-gray-700 rounded-lg mb-3 flex items-center justify-center group-hover:bg-gray-600 transition-colors relative">
                    <Music size={32} className="text-gray-500" />
                    <button
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-50 rounded-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        playTrack(track.id);
                      }}
                    >
                      <Play size={32} className="text-white ml-1" fill="white" />
                    </button>
                  </div>
                  <h3 className="font-semibold truncate" title={track.title || 'Unknown'}>
                    {track.title || 'Unknown Title'}
                  </h3>
                  <p className="text-sm text-gray-400 truncate" title={track.artist || 'Unknown Artist'}>
                    {track.artist || 'Unknown Artist'}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {recommendationGroups.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold mb-4">Recommended for You</h2>
              {recommendationGroups.map((group, idx) => (
                <div key={idx} className="mb-6">
                  <h3 className="text-lg font-semibold mb-3 text-gray-300">
                    {group[0]?.genre} • {group[0]?.artist}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    {group.map((track) => (
                      <div
                        key={track.id}
                        className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors cursor-pointer group"
                        onClick={() => playTrack(track.id)}
                      >
                        <div className="aspect-square bg-gray-700 rounded-lg mb-3 flex items-center justify-center group-hover:bg-gray-600 transition-colors relative">
                          <Music size={32} className="text-gray-500" />
                          <button
                            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-50 rounded-lg"
                            onClick={(e) => {
                              e.stopPropagation();
                              playTrack(track.id);
                            }}
                          >
                            <Play size={32} className="text-white ml-1" fill="white" />
                          </button>
                        </div>
                        <h3 className="font-semibold truncate" title={track.title || 'Unknown'}>
                          {track.title || 'Unknown Title'}
                        </h3>
                        <p className="text-sm text-gray-400 truncate" title={track.artist || 'Unknown Artist'}>
                          {track.artist || 'Unknown Artist'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          <section>
            <h2 className="text-2xl font-bold mb-4">Your Library</h2>
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
                  {tracks.slice(0, 20).map((track, index) => (
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
          </section>
        </>
      )}
    </div>
  );
}
