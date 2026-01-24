import { useEffect, useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useLibraryData, useLibraryActions } from '../store/selectors';
import { Play, Music } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

function AlbumDetailView({
  albumName,
  artist,
  onBack,
}: {
  albumName: string;
  artist: string | null;
  onBack: () => void;
}) {
  const { albumTracks, albumLoading, loadAlbumTracks, playTrack, playAlbum } = useStore();
  const [coverArt, setCoverArt] = useState<string | null>(null);

  useEffect(() => {
    loadAlbumTracks(albumName, artist);
    invoke<string | null>('get_album_cover', { albumName, artist: artist || null })
      .then(setCoverArt)
      .catch(() => setCoverArt(null));
  }, [albumName, artist, loadAlbumTracks]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalDuration = albumTracks.reduce((sum, track) => sum + (track.duration || 0), 0);

  if (albumLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-tertiary">Loading album...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="text-text-tertiary hover:text-text-primary transition-colors mb-4"
      >
        ← Back to Dashboard
      </button>

      <div className="flex gap-6">
        <div className="w-64 h-64 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
          {coverArt ? (
            <img src={coverArt} alt={albumName} className="w-full h-full object-cover rounded-xl" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary-600/20 to-accent-600/20 rounded-xl flex items-center justify-center">
              <Music size={64} className="text-primary-400" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-4xl font-bold mb-2 text-text-primary">{albumName}</h1>
          <p className="text-xl text-text-secondary mb-4">{artist || 'Unknown Artist'}</p>
          <p className="text-text-tertiary mb-4">
            {albumTracks.length} track{albumTracks.length !== 1 ? 's' : ''} •{' '}
            {formatDuration(totalDuration)}
          </p>
          <button
            onClick={() => playAlbum(albumName, artist)}
            className="btn-primary flex items-center gap-2"
          >
            <Play size={20} fill="currentColor" />
            Play Album
          </button>
        </div>
      </div>

      <div className="bg-bg-card rounded-2xl overflow-hidden border border-bg-surface shadow-lg">
        <table className="w-full">
          <thead className="bg-bg-elevated border-b border-bg-surface">
            <tr>
              <th className="text-left p-4 text-text-tertiary font-medium text-sm w-12">#</th>
              <th className="text-left p-4 text-text-tertiary font-medium text-sm">Title</th>
              <th className="text-right p-4 text-text-tertiary font-medium text-sm">Duration</th>
            </tr>
          </thead>
          <tbody>
            {albumTracks.map((track, index) => (
              <tr
                key={track.id}
                className="hover:bg-bg-hover cursor-pointer transition-colors"
                onDoubleClick={() => playTrack(track.id)}
              >
                <td className="p-4 text-text-tertiary">{track.track_number || index + 1}</td>
                <td className="p-4 font-semibold text-text-primary">
                  {track.title || 'Unknown Title'}
                </td>
                <td className="p-4 text-right text-text-tertiary font-medium">
                  {formatDuration(track.duration)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { tracks, albums } = useLibraryData();
  const { loadTracks, loadAlbums, playAlbum, playTrack } = useLibraryActions();
  const [selectedAlbum, setSelectedAlbum] = useState<{
    name: string;
    artist: string | null;
  } | null>(null);

  useEffect(() => {
    loadTracks();
    loadAlbums();
  }, [loadTracks, loadAlbums]);

  // Memoized: sort albums by created_at and take top 12
  const recentlyAddedAlbums = useMemo(
    () => [...albums].sort((a, b) => b.created_at - a.created_at).slice(0, 12),
    [albums]
  );

  // Memoized: group tracks by genre+artist for recommendations
  const recommendationGroups = useMemo(() => {
    const recommendations = tracks
      .filter((t) => t.genre && t.artist)
      .reduce(
        (acc, track) => {
          const key = `${track.genre}-${track.artist}`;
          if (!acc[key]) {
            acc[key] = [];
          }
          if (acc[key].length < 6) {
            acc[key].push(track);
          }
          return acc;
        },
        {} as Record<string, typeof tracks>
      );
    return Object.values(recommendations).slice(0, 3);
  }, [tracks]);

  if (selectedAlbum) {
    return (
      <AlbumDetailView
        albumName={selectedAlbum.name}
        artist={selectedAlbum.artist}
        onBack={() => setSelectedAlbum(null)}
      />
    );
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2 text-text-primary">Good evening</h1>
        <p className="text-text-tertiary">Welcome back to OSMP</p>
      </div>

      {tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-text-tertiary">
          <Music size={64} className="mb-4 opacity-50" />
          <p className="text-lg">No music found</p>
          <p className="text-sm mt-2">Add scan folders in Settings to get started</p>
        </div>
      ) : (
        <>
          <section>
            <h2 className="text-2xl font-bold mb-4 text-text-primary">Recently Added</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {recentlyAddedAlbums.map((album) => (
                <div
                  key={`${album.name}-${album.artist || ''}`}
                  className="bg-bg-card rounded-xl p-4 hover:bg-bg-hover transition-all cursor-pointer group border border-bg-surface hover:border-primary-600/30 hover:shadow-lg hover:shadow-primary-600/10"
                  onClick={() => setSelectedAlbum({ name: album.name, artist: album.artist })}
                >
                  <div className="aspect-square bg-gradient-to-br from-primary-600/20 to-accent-600/20 rounded-xl mb-3 flex items-center justify-center group-hover:from-primary-600/30 group-hover:to-accent-600/30 transition-all relative overflow-hidden">
                    {album.cover_art ? (
                      <img
                        src={album.cover_art}
                        alt={album.name}
                        className="w-full h-full object-cover rounded-xl"
                      />
                    ) : (
                      <Music size={32} className="text-primary-400" />
                    )}
                    <button
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-xl backdrop-blur-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        playAlbum(album.name, album.artist);
                      }}
                    >
                      <Play size={32} className="text-white ml-1" fill="white" />
                    </button>
                  </div>
                  <h3 className="font-semibold truncate text-text-primary" title={album.name}>
                    {album.name}
                  </h3>
                  <p
                    className="text-sm text-text-tertiary truncate"
                    title={album.artist || 'Unknown Artist'}
                  >
                    {album.artist || 'Unknown Artist'}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {recommendationGroups.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold mb-4 text-text-primary">Recommended for You</h2>
              {recommendationGroups.map((group, idx) => (
                <div key={idx} className="mb-6">
                  <h3 className="text-lg font-semibold mb-3 text-text-secondary">
                    {group[0]?.genre} • {group[0]?.artist}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    {group.map((track) => {
                      // Find album cover for this track
                      const album = albums.find(
                        (a) => a.name === track.album && a.artist === track.artist
                      );
                      return (
                        <div
                          key={track.id}
                          className="bg-bg-card rounded-xl p-4 hover:bg-bg-hover transition-all cursor-pointer group border border-bg-surface hover:border-primary-600/30 hover:shadow-lg hover:shadow-primary-600/10"
                          onClick={() => playTrack(track.id)}
                        >
                          <div className="aspect-square bg-gradient-to-br from-primary-600/20 to-accent-600/20 rounded-xl mb-3 flex items-center justify-center group-hover:from-primary-600/30 group-hover:to-accent-600/30 transition-all relative overflow-hidden">
                            {album?.cover_art ? (
                              <img
                                src={album.cover_art}
                                alt={track.album || 'Album'}
                                className="w-full h-full object-cover rounded-xl"
                              />
                            ) : (
                              <Music size={32} className="text-primary-400" />
                            )}
                            <button
                              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-xl backdrop-blur-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                playTrack(track.id);
                              }}
                            >
                              <Play size={32} className="text-white ml-1" fill="white" />
                            </button>
                          </div>
                          <h3
                            className="font-semibold truncate text-text-primary"
                            title={track.title || 'Unknown'}
                          >
                            {track.title || 'Unknown Title'}
                          </h3>
                          <p
                            className="text-sm text-text-tertiary truncate"
                            title={track.artist || 'Unknown Artist'}
                          >
                            {track.artist || 'Unknown Artist'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>
          )}

          <section>
            <h2 className="text-2xl font-bold mb-4 text-text-primary">Your Library</h2>
            <div className="bg-bg-card rounded-2xl overflow-hidden border border-bg-surface shadow-lg">
              <table className="w-full">
                <thead className="bg-bg-elevated border-b border-bg-surface">
                  <tr>
                    <th className="text-left p-4 text-text-tertiary font-medium text-sm">#</th>
                    <th className="text-left p-4 text-text-tertiary font-medium text-sm">Title</th>
                    <th className="text-left p-4 text-text-tertiary font-medium text-sm">Artist</th>
                    <th className="text-left p-4 text-text-tertiary font-medium text-sm">Album</th>
                    <th className="text-right p-4 text-text-tertiary font-medium text-sm">
                      Duration
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tracks.slice(0, 20).map((track, index) => (
                    <tr
                      key={track.id}
                      className="hover:bg-bg-hover cursor-pointer transition-colors"
                      onClick={() => playTrack(track.id)}
                    >
                      <td className="p-4 text-text-tertiary">{index + 1}</td>
                      <td className="p-4 font-semibold text-text-primary">
                        {track.title || 'Unknown Title'}
                      </td>
                      <td className="p-4 text-text-secondary">
                        {track.artist || 'Unknown Artist'}
                      </td>
                      <td className="p-4 text-text-secondary">{track.album || 'Unknown Album'}</td>
                      <td className="p-4 text-right text-text-tertiary font-medium">
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
