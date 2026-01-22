import { useState } from "react";
import Dashboard from "./components/Dashboard";
import Library from "./components/Library";
import Player from "./components/Player";
import Search from "./components/Search";
import Settings from "./components/Settings";

type View = "dashboard" | "library" | "search" | "settings";

function App() {
  const [currentView, setCurrentView] = useState<View>("dashboard");

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 p-4 flex flex-col">
        <h1 className="text-2xl font-bold mb-8">OSMP</h1>
        <nav className="flex-1">
          <ul className="space-y-2">
            <li>
              <button
                onClick={() => setCurrentView("dashboard")}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  currentView === "dashboard"
                    ? "bg-gray-700 text-white"
                    : "text-gray-300 hover:bg-gray-700"
                }`}
              >
                Dashboard
              </button>
            </li>
            <li>
              <button
                onClick={() => setCurrentView("library")}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  currentView === "library"
                    ? "bg-gray-700 text-white"
                    : "text-gray-300 hover:bg-gray-700"
                }`}
              >
                Library
              </button>
            </li>
            <li>
              <button
                onClick={() => setCurrentView("search")}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  currentView === "search"
                    ? "bg-gray-700 text-white"
                    : "text-gray-300 hover:bg-gray-700"
                }`}
              >
                Search
              </button>
            </li>
            <li>
              <button
                onClick={() => setCurrentView("settings")}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  currentView === "settings"
                    ? "bg-gray-700 text-white"
                    : "text-gray-300 hover:bg-gray-700"
                }`}
              >
                Settings
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
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
