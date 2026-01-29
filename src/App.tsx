import { useState, useEffect, lazy, Suspense } from 'react';
import {
  LayoutDashboard,
  Library as LibraryIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Music,
  Disc,
} from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import Dashboard from './components/Dashboard';
import Library from './components/Library';
import Albums from './components/Albums';
import Player from './components/Player';
import PlaylistsSidebar from './components/PlaylistsSidebar';
import Visualizer from './components/Visualizer';
import ErrorBoundary from './components/ErrorBoundary';
import UpdateBanner from './components/UpdateBanner';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

// Lazy-loaded views (not needed at startup)
const Search = lazy(() => import('./components/Search'));
const Settings = lazy(() => import('./components/Settings'));
const PlaylistDetail = lazy(() => import('./components/PlaylistDetail'));
const EqualizerPanel = lazy(() => import('./components/EqualizerPanel'));
import { useStore, setupMediaControlListeners } from './store/useStore';
import {
  useCurrentTrack,
  useCurrentCoverArt,
  useVisualizerState,
  useEqState,
} from './store/selectors';

type View = 'dashboard' | 'library' | 'albums' | 'search' | 'settings' | 'playlist';

function App() {
  const [selectedView, setSelectedView] = useState<View>('dashboard');
  const currentTrack = useCurrentTrack();
  const currentCoverArt = useCurrentCoverArt();
  const { visualizerEnabled } = useVisualizerState();
  const { toggleEqPanel } = useEqState();
  const currentPlaylist = useStore((s) => s.currentPlaylist);
  const setCurrentPlaylist = useStore((s) => s.setCurrentPlaylist);
  const loadEqSettings = useStore((s) => s.loadEqSettings);
  const clearSelection = useStore((s) => s.clearSelection);

  const loadTracks = useStore((s) => s.loadTracks);
  const loadAlbums = useStore((s) => s.loadAlbums);

  // Register global keyboard shortcuts
  useKeyboardShortcuts();

  // Global mouse-based drag from any tr[data-track-id] to [data-playlist-id].
  // Uses mouse events instead of pointer events for reliable WKWebView support.
  // Inline in App so it's always active regardless of which view is shown.
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let dragTrackIds: number[] = [];
    let dragging = false;
    let overlay: HTMLDivElement | null = null;
    let lastHighlighted: HTMLElement | null = null;

    const blockSelect = (e: Event) => e.preventDefault();

    const clearHighlight = () => {
      if (lastHighlighted) {
        lastHighlighted.style.outline = '';
        lastHighlighted.style.background = '';
        lastHighlighted = null;
      }
    };

    const cleanup = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.removeEventListener('selectstart', blockSelect);
      if (overlay) {
        overlay.remove();
        overlay = null;
      }
      clearHighlight();
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      dragging = false;
      dragTrackIds = [];
    };

    const hitTest = (x: number, y: number): Element | null => {
      // Hide overlay so elementFromPoint sees through to real elements
      if (overlay) overlay.style.display = 'none';
      const el = document.elementFromPoint(x, y);
      if (overlay) overlay.style.display = '';
      return el;
    };

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('button, input, label, a')) return;

      const row = target.closest('tr[data-track-id]');
      if (!row) return;
      e.preventDefault(); // Prevents text selection from starting

      const trackId = Number(row.getAttribute('data-track-id'));
      if (!trackId) return;

      startX = e.clientX;
      startY = e.clientY;

      const sel = useStore.getState().selectedTracks;
      dragTrackIds = sel.includes(trackId) && sel.length > 1 ? [...sel] : [trackId];

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };

    const onMove = (e: MouseEvent) => {
      if (!dragging) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (dx * dx + dy * dy <= 64) return;

        dragging = true;
        window.getSelection()?.removeAllRanges();
        document.body.style.userSelect = 'none';
        document.body.style.webkitUserSelect = 'none';
        document.addEventListener('selectstart', blockSelect);
        document.dispatchEvent(new CustomEvent('osmp:drag-start'));

        overlay = document.createElement('div');
        overlay.textContent = `${dragTrackIds.length} track${dragTrackIds.length > 1 ? 's' : ''}`;
        overlay.style.cssText =
          'position:fixed;left:0;top:0;pointer-events:none;z-index:9999;' +
          'padding:6px 12px;background:#6366f1;color:#fff;border-radius:8px;' +
          'font-size:13px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,.3);' +
          'white-space:nowrap;will-change:transform;';
        document.body.appendChild(overlay);
        document.body.style.cursor = 'grabbing';
      }

      if (overlay) {
        overlay.style.transform = `translate(${e.clientX + 14}px,${e.clientY + 14}px)`;
      }

      const el = hitTest(e.clientX, e.clientY);
      const playlistEl = el?.closest('[data-playlist-id]') as HTMLElement | null;

      if (lastHighlighted && lastHighlighted !== playlistEl) clearHighlight();
      if (playlistEl) {
        playlistEl.style.outline = '2px solid #6366f1';
        playlistEl.style.background = 'rgba(99,102,241,.1)';
        lastHighlighted = playlistEl;
      }
    };

    const onUp = async (e: MouseEvent) => {
      if (!dragging) {
        cleanup();
        return;
      }

      const el = hitTest(e.clientX, e.clientY);
      const playlistEl = el?.closest('[data-playlist-id]');

      if (playlistEl && dragTrackIds.length > 0) {
        const playlistId = Number(playlistEl.getAttribute('data-playlist-id'));
        if (playlistId) {
          try {
            const store = useStore.getState();
            await store.addTracksToPlaylist(playlistId, dragTrackIds);
            await store.loadPlaylists();
            const cp = store.currentPlaylist;
            if (cp && cp.id === playlistId) {
              await store.loadPlaylistTracks(playlistId);
            }
          } catch {
            /* drop failed */
          }
        }
      }
      cleanup();
    };

    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      cleanup();
    };
  }, []);

  // Set up media control listeners, load EQ settings, and preload data on mount
  useEffect(() => {
    setupMediaControlListeners();
    loadEqSettings();
    loadTracks();
    loadAlbums();
  }, [loadEqSettings, loadTracks, loadAlbums]);

  // Auto-reload library when background scan finds new tracks
  useEffect(() => {
    const unlisten = listen<number>('library-updated', () => {
      loadTracks(true);
      loadAlbums(true);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [loadTracks, loadAlbums]);

  // Derive currentView from selectedView and currentPlaylist
  const currentView = currentPlaylist ? 'playlist' : selectedView;

  const navItems = [
    { id: 'dashboard' as View, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'library' as View, label: 'Library', icon: LibraryIcon },
    { id: 'albums' as View, label: 'Albums', icon: Disc },
    { id: 'search' as View, label: 'Search', icon: SearchIcon },
    { id: 'settings' as View, label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="flex h-screen bg-bg-base text-text-primary">
      {/* Sidebar */}
      <aside className="w-64 bg-bg-elevated border-r border-bg-surface flex flex-col h-screen select-none">
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto px-6 pt-6 min-h-0">
          <nav>
            <ul className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        setSelectedView(item.id);
                        setCurrentPlaylist(null);
                        clearSelection();
                      }}
                      className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center gap-3 ${
                        isActive
                          ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                          : 'text-text-secondary hover:bg-bg-card hover:text-text-primary'
                      }`}
                    >
                      <Icon size={20} className={isActive ? 'text-white' : 'text-text-tertiary'} />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Playlists Sidebar */}
          <PlaylistsSidebar />
        </div>

        {/* Album Art - Fixed at bottom with static size */}
        <div className="flex-shrink-0 p-4 border-t border-bg-surface">
          <div className="w-full relative" style={{ maxWidth: '200px', margin: '0 auto' }}>
            {currentTrack && currentCoverArt ? (
              <img
                src={currentCoverArt}
                alt="Album art"
                className="w-full aspect-square rounded-lg object-cover shadow-lg"
              />
            ) : (
              <div className="w-full aspect-square rounded-lg bg-bg-card flex items-center justify-center">
                <Music size={48} className="text-text-tertiary" />
              </div>
            )}
            {visualizerEnabled && <Visualizer onClick={toggleEqPanel} />}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-bg-base">
        <ErrorBoundary>
          <UpdateBanner />
          <div className="flex-1 overflow-y-auto p-8">
            {/* Main views kept mounted for instant navigation */}
            <div style={{ display: currentView === 'dashboard' ? 'block' : 'none' }}>
              <Dashboard />
            </div>
            <div style={{ display: currentView === 'library' ? 'block' : 'none' }}>
              <Library />
            </div>
            <div style={{ display: currentView === 'albums' ? 'block' : 'none' }}>
              <Albums />
            </div>
            {/* Lazy-loaded views */}
            <Suspense fallback={null}>
              {currentView === 'search' && <Search />}
              {currentView === 'settings' && <Settings />}
              {currentView === 'playlist' && currentPlaylist && (
                <PlaylistDetail
                  playlistId={currentPlaylist.id}
                  onBack={() => {
                    setCurrentPlaylist(null);
                    setSelectedView('dashboard');
                  }}
                />
              )}
            </Suspense>
          </div>
        </ErrorBoundary>
        <Player />
      </main>

      {/* Equalizer Panel Modal */}
      <Suspense fallback={null}>
        <EqualizerPanel />
      </Suspense>
    </div>
  );
}

export default App;
