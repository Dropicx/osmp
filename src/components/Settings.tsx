import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ScanFolder } from '../types';
import { FolderPlus, Trash2, Play, Loader } from 'lucide-react';

export default function Settings() {
  const [folders, setFolders] = useState<ScanFolder[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  const [newFolderPath, setNewFolderPath] = useState('');

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    try {
      const folders = await invoke<ScanFolder[]>('get_scan_folders');
      setFolders(folders);
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  };

  const handleAddFolder = async () => {
    if (!newFolderPath.trim()) return;
    try {
      await invoke('add_scan_folder', { path: newFolderPath.trim() });
      setNewFolderPath('');
      await loadFolders();
    } catch (error) {
      console.error('Failed to add folder:', error);
    }
  };

  const handleRemoveFolder = async (id: number) => {
    try {
      await invoke('remove_scan_folder', { id });
      await loadFolders();
    } catch (error) {
      console.error('Failed to remove folder:', error);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    setScanProgress('Scanning folders...');
    try {
      await invoke('scan_folders');
      setScanProgress('Scan complete!');
      setTimeout(() => {
        setScanProgress('');
        setScanning(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to scan:', error);
      setScanProgress('Scan failed');
      setScanning(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-gray-400">Manage your music library</p>
      </div>

      <section className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Scan Folders</h2>
          <button
            onClick={handleScan}
            disabled={scanning || folders.length === 0}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
          >
            {scanning ? (
              <>
                <Loader size={16} className="animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Play size={16} />
                Scan Now
              </>
            )}
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={newFolderPath}
            onChange={(e) => setNewFolderPath(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddFolder()}
            placeholder="Enter folder path (e.g., /Users/username/Music)"
            className="flex-1 bg-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-white"
          />
          <button
            onClick={handleAddFolder}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center gap-2"
          >
            <FolderPlus size={16} />
            Add Folder
          </button>
        </div>

        {scanProgress && (
          <div className="mb-4 p-3 bg-gray-700 rounded-lg text-sm">
            {scanProgress}
          </div>
        )}

        {folders.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>No scan folders configured</p>
            <p className="text-sm mt-2">Click "Add Folder" to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="flex items-center justify-between p-4 bg-gray-900 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium">{folder.path}</p>
                  <p className="text-sm text-gray-400">
                    {folder.enabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveFolder(folder.id)}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-red-400"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Metadata</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Auto-fetch metadata
            </label>
            <p className="text-sm text-gray-400 mb-2">
              Automatically fetch metadata from MusicBrainz when scanning new tracks
            </p>
            <input
              type="checkbox"
              className="rounded"
              defaultChecked={false}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
