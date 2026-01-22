import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { ScanFolder, Track } from '../types';
import { FolderPlus, Trash2, Play, Loader } from 'lucide-react';

export default function Settings() {
  const [folders, setFolders] = useState<ScanFolder[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');

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
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Music Folder'
      });

      if (selected && typeof selected === 'string') {
        await invoke('add_scan_folder', { path: selected });
        await loadFolders();
      }
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
      const tracks = await invoke<Track[]>('scan_folders');
      setScanProgress(`Scan complete! Found ${tracks.length} tracks.`);
      setTimeout(() => {
        setScanProgress('');
        setScanning(false);
      }, 3000);
    } catch (error) {
      console.error('Failed to scan:', error);
      setScanProgress('Scan failed');
      setScanning(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-text-primary">Settings</h1>
        <p className="text-text-tertiary">Manage your music library</p>
      </div>

      <section className="bg-bg-card rounded-2xl p-6 border border-bg-surface shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">Scan Folders</h2>
            <p className="text-sm text-text-tertiary mt-1">Add folders to scan for music files</p>
          </div>
          <button
            onClick={handleScan}
            disabled={scanning || folders.length === 0}
            className="btn-success flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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

        <div className="mb-4">
          <button
            onClick={handleAddFolder}
            className="btn-secondary flex items-center gap-2"
          >
            <FolderPlus size={16} />
            Add Folder
          </button>
        </div>

        {scanProgress && (
          <div className="mb-4 p-4 bg-primary-600/10 border border-primary-600/20 rounded-xl text-sm text-text-primary">
            {scanProgress}
          </div>
        )}

        {folders.length === 0 ? (
          <div className="text-center py-12 text-text-tertiary">
            <p className="text-lg mb-2">No scan folders configured</p>
            <p className="text-sm">Click "Add Folder" to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="flex items-center justify-between p-4 bg-bg-elevated rounded-xl border border-bg-surface hover:border-bg-hover transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-text-primary truncate">{folder.path}</p>
                  <p className="text-sm text-text-tertiary mt-1">
                    {folder.enabled ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-success rounded-full"></span>
                        Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-text-muted rounded-full"></span>
                        Disabled
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveFolder(folder.id)}
                  className="btn-icon text-danger hover:bg-danger/10 ml-4"
                  title="Remove folder"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-bg-card rounded-2xl p-6 border border-bg-surface shadow-lg">
        <h2 className="text-xl font-semibold mb-6 text-text-primary">Metadata</h2>
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <label className="block text-sm font-semibold mb-2 text-text-primary">
                Auto-fetch metadata
              </label>
              <p className="text-sm text-text-tertiary">
                Automatically fetch metadata from MusicBrainz when scanning new tracks
              </p>
            </div>
            <label className="toggle-switch ml-6 flex-shrink-0">
              <input type="checkbox" defaultChecked={false} />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>
      </section>
    </div>
  );
}
