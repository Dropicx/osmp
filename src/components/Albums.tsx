import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { invoke } from '@tauri-apps/api/core';
import { Music, Play, List, ListPlus } from 'lucide-react';
import { formatDuration } from '../utils/formatting';
import { DEFAULT_TITLE, DEFAULT_ARTIST } from '../constants';

interface AlbumDetailProps {
  albumName: string;
  artist: string | null;
  onBack: () => void;
}

function AlbumDetail({ albumName, artist, onBack }: AlbumDetailProps) {
  const { albumTracks, albumLoading, loadAlbumTracks, playTrack, playAlbum, addToQueue } =
    useStore();
  const [coverArt, setCoverArt] = useState<string | null>(null);

  useEffect(() => {
    loadAlbumTracks(albumName, artist);
    invoke<string | null>('get_album_cover', { albumName, artist: artist || null })
      .then(setCoverArt)
      .catch(() => setCoverArt(null));
  }, [albumName, artist, loadAlbumTracks]);

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
        ← Back to Albums
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
          <p className="text-xl text-text-secondary mb-4">{artist || DEFAULT_ARTIST}</p>
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
              <th className="text-center p-4 text-text-tertiary font-medium text-sm w-24">Queue</th>
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
                  {track.title || DEFAULT_TITLE}
                </td>
                <td className="p-4 text-right text-text-tertiary font-medium">
                  {formatDuration(track.duration)}
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addToQueue([track.id], 'end');
                      }}
                      className="btn-icon"
                      title="Add to Queue"
                    >
                      <List size={14} className="text-text-tertiary" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addToQueue([track.id], 'next');
                      }}
                      className="btn-icon"
                      title="Add Next to Queue"
                    >
                      <ListPlus size={14} className="text-text-tertiary" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Albums() {
  const { albums, albumLoading, loadAlbums } = useStore();
  const [selectedAlbum, setSelectedAlbum] = useState<{
    name: string;
    artist: string | null;
  } | null>(null);

  useEffect(() => {
    loadAlbums();
  }, [loadAlbums]);

  if (selectedAlbum) {
    return (
      <AlbumDetail
        albumName={selectedAlbum.name}
        artist={selectedAlbum.artist}
        onBack={() => setSelectedAlbum(null)}
      />
    );
  }

  if (albumLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-tertiary">Loading albums...</div>
      </div>
    );
  }

  if (albums.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-text-tertiary">
        <Music size={64} className="mb-4 opacity-50" />
        <p className="text-lg">No albums found</p>
        <p className="text-sm mt-2">Albums will appear here once you scan your music</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-text-primary">Albums</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {albums.map((album) => (
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
                  setSelectedAlbum({ name: album.name, artist: album.artist });
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
              title={album.artist || DEFAULT_ARTIST}
            >
              {album.artist || DEFAULT_ARTIST}
            </p>
            {album.year && <p className="text-xs text-text-tertiary mt-1">{album.year}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
