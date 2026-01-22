import { useState } from "react";
import { LayoutDashboard, Library as LibraryIcon, Search as SearchIcon, Settings as SettingsIcon, Music } from "lucide-react";
import Dashboard from "./components/Dashboard";
import Library from "./components/Library";
import Player from "./components/Player";
import Search from "./components/Search";
import Settings from "./components/Settings";
import { useStore } from "./store/useStore";

type View = "dashboard" | "library" | "search" | "settings";

function App() {
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const { currentTrack, currentCoverArt } = useStore();

  const navItems = [
    { id: "dashboard" as View, label: "Dashboard", icon: LayoutDashboard },
    { id: "library" as View, label: "Library", icon: LibraryIcon },
    { id: "search" as View, label: "Search", icon: SearchIcon },
    { id: "settings" as View, label: "Settings", icon: SettingsIcon },
  ];

  return (
    <div className="flex h-screen bg-bg-base text-text-primary">
      {/* Sidebar */}
      <aside className="w-64 bg-bg-elevated border-r border-bg-surface p-6 flex flex-col">
        <h1 className="text-2xl font-bold mb-8 bg-gradient-to-r from-primary-500 to-accent-500 bg-clip-text text-transparent">
          OSMP
        </h1>
        <nav className="flex-1">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setCurrentView(item.id)}
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

        {/* Album Art */}
        <div className="mt-auto pt-4">
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
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-bg-base">
        <div className="flex-1 overflow-y-auto p-8">
          {currentView === "dashboard" && <Dashboard />}
          {currentView === "library" && <Library />}
          {currentView === "search" && <Search />}
          {currentView === "settings" && <Settings />}
        </div>
        <Player />
      </main>
    </div>
  );
}

export default App;
