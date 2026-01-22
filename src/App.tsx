import { useState, useEffect } from "react";
import { LayoutDashboard, Library as LibraryIcon, Search as SearchIcon, Settings as SettingsIcon, Music, Disc } from "lucide-react";
import Dashboard from "./components/Dashboard";
import Library from "./components/Library";
import Albums from "./components/Albums";
import Player from "./components/Player";
import Search from "./components/Search";
import Settings from "./components/Settings";
import PlaylistsSidebar from "./components/PlaylistsSidebar";
import PlaylistDetail from "./components/PlaylistDetail";
import Visualizer from "./components/Visualizer";
import EqualizerPanel from "./components/EqualizerPanel";
import { useStore, setupMediaControlListeners } from "./store/useStore";

type View = "dashboard" | "library" | "albums" | "search" | "settings" | "playlist";

function App() {
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const { currentTrack, currentCoverArt, currentPlaylist, setCurrentPlaylist, toggleEqPanel, loadEqSettings, visualizerEnabled } = useStore();

  // Set up media control listeners and load EQ settings on mount
  useEffect(() => {
    setupMediaControlListeners();
    loadEqSettings();
  }, [loadEqSettings]);

  // Update view when playlist is selected/deselected
  useEffect(() => {
    if (currentPlaylist) {
      setCurrentView("playlist");
    }
  }, [currentPlaylist]);

  const navItems = [
    { id: "dashboard" as View, label: "Dashboard", icon: LayoutDashboard },
    { id: "library" as View, label: "Library", icon: LibraryIcon },
    { id: "albums" as View, label: "Albums", icon: Disc },
    { id: "search" as View, label: "Search", icon: SearchIcon },
    { id: "settings" as View, label: "Settings", icon: SettingsIcon },
  ];

  return (
    <div className="flex h-screen bg-bg-base text-text-primary">
      {/* Sidebar */}
      <aside className="w-64 bg-bg-elevated border-r border-bg-surface flex flex-col h-screen">
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
                        setCurrentView(item.id);
                        setCurrentPlaylist(null);
                      }}
                      className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center gap-3 ${
                        isActive
                          ? "bg-primary-600 text-white shadow-lg shadow-primary-600/30"
                          : "text-text-secondary hover:bg-bg-card hover:text-text-primary"
                      }`}
                    >
                      <Icon size={20} className={isActive ? "text-white" : "text-text-tertiary"} />
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
        <div className="flex-1 overflow-y-auto p-8">
          {currentView === "dashboard" && <Dashboard />}
          {currentView === "library" && <Library />}
          {currentView === "albums" && <Albums />}
          {currentView === "search" && <Search />}
          {currentView === "settings" && <Settings />}
          {currentView === "playlist" && currentPlaylist && (
            <PlaylistDetail
              playlistId={currentPlaylist.id}
              onBack={() => {
                setCurrentPlaylist(null);
                setCurrentView("dashboard");
              }}
            />
          )}
        </div>
        <Player />
      </main>

      {/* Equalizer Panel Modal */}
      <EqualizerPanel />
    </div>
  );
}

export default App;
