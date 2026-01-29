import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { ScanFolder, ScanDiscovery, ScanProgress, ScanResult } from '../types';
import {
  FolderPlus,
  Trash2,
  Play,
  Loader,
  X,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Heart,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { COLUMN_DEFINITIONS } from '../constants';

interface ParsedError {
  file: string;
  reason: string;
}

function parseErrorFiles(errorFiles: string[]): Map<string, ParsedError[]> {
  const grouped = new Map<string, ParsedError[]>();

  for (const entry of errorFiles) {
    const separatorIdx = entry.lastIndexOf('|');
    let file: string;
    let reason: string;

    if (separatorIdx !== -1) {
      file = entry.substring(0, separatorIdx);
      reason = entry.substring(separatorIdx + 1);
    } else {
      file = entry;
      reason = 'Unknown error';
    }

    // Normalize reason for grouping
    let groupKey = reason;
    if (reason.includes('too short')) {
      groupKey = 'Too short (< 30s)';
    } else if (reason.includes('sound effects')) {
      groupKey = 'In sound effects directory';
    } else if (reason.includes('No such file')) {
      groupKey = 'File not found';
    } else if (reason.includes('permission')) {
      groupKey = 'Permission denied';
    }

    const existing = grouped.get(groupKey) || [];
    existing.push({ file, reason });
    grouped.set(groupKey, existing);
  }

  return grouped;
}

function ErrorList({ errorFiles }: { errorFiles: string[] }) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const grouped = parseErrorFiles(errorFiles);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedGroups(new Set(grouped.keys()));
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-text-tertiary">
          Skipped files by reason ({errorFiles.length} total)
        </p>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="text-xs text-text-tertiary hover:text-text-secondary"
          >
            Expand all
          </button>
          <span className="text-text-tertiary">|</span>
          <button
            onClick={collapseAll}
            className="text-xs text-text-tertiary hover:text-text-secondary"
          >
            Collapse all
          </button>
        </div>
      </div>

      {Array.from(grouped.entries()).map(([reason, files]) => (
        <div key={reason} className="border border-bg-surface rounded-lg overflow-hidden">
          <button
            onClick={() => toggleGroup(reason)}
            className="w-full flex items-center justify-between p-2 bg-bg-elevated hover:bg-bg-hover text-left"
          >
            <div className="flex items-center gap-2">
              {expandedGroups.has(reason) ? (
                <ChevronDown size={14} className="text-text-tertiary" />
              ) : (
                <ChevronRight size={14} className="text-text-tertiary" />
              )}
              <span className="text-xs font-medium text-text-secondary">{reason}</span>
            </div>
            <span className="text-xs text-text-tertiary bg-bg-surface px-2 py-0.5 rounded">
              {files.length}
            </span>
          </button>

          {expandedGroups.has(reason) && (
            <ul className="text-xs max-h-48 overflow-y-auto bg-bg-card">
              {files.map((item, idx) => (
                <li
                  key={idx}
                  className="px-3 py-1.5 text-text-muted border-t border-bg-surface hover:bg-bg-elevated truncate"
                  title={item.file}
                >
                  {item.file.split('/').pop()}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Settings() {
  const [folders, setFolders] = useState<ScanFolder[]>([]);
  const [scanning, setScanning] = useState(false);
  const [discovery, setDiscovery] = useState<ScanDiscovery | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const {
    visualizerEnabled,
    setVisualizerEnabled,
    visualizerOpacity,
    setVisualizerOpacity,
    columnVisibility,
    setColumnVisibility,
    resetColumnWidths,
    resetColumnVisibility,
  } = useStore();

  const loadFolders = async () => {
    try {
      const folders = await invoke<ScanFolder[]>('get_scan_folders');
      setFolders(folders);
    } catch {
      /* silently handled */
    }
  };

  // Load folders on mount
  useEffect(() => {
    invoke<ScanFolder[]>('get_scan_folders')
      .then(setFolders)
      .catch(() => {
        /* silently handled */
      });
  }, []);

  // Subscribe to scan events
  useEffect(() => {
    const unlistenDiscovery = listen<ScanDiscovery>('scan-discovery', (event) => {
      setDiscovery(event.payload);
    });

    const unlistenProgress = listen<ScanProgress>('scan-progress', (event) => {
      setProgress(event.payload);
      if (event.payload.is_complete) {
        setScanning(false);
        setDiscovery(null);
      }
    });

    return () => {
      unlistenDiscovery.then((fn) => fn());
      unlistenProgress.then((fn) => fn());
    };
  }, []);

  const handleAddFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Music Folder',
      });

      if (selected && typeof selected === 'string') {
        await invoke('add_scan_folder', { path: selected });
        await loadFolders();
      }
    } catch {
      /* silently handled */
    }
  };

  const handleRemoveFolder = async (id: number) => {
    try {
      await invoke('remove_scan_folder', { id });
      await loadFolders();
    } catch {
      /* silently handled */
    }
  };

  const handleScan = async () => {
    setScanning(true);
    setDiscovery(null);
    setProgress(null);
    setScanResult(null);
    setShowErrors(false);

    try {
      const result = await invoke<ScanResult>('scan_folders');
      setScanResult(result);
      setScanning(false);
      setDiscovery(null);
    } catch {
      /* silently handled */
      setScanning(false);
      setDiscovery(null);
      setScanResult(null);
    }
  };

  const handleCancelScan = async () => {
    try {
      await invoke('cancel_scan');
    } catch {
      /* silently handled */
    }
  };

  const formatDuration = (secs: number): string => {
    if (secs < 60) return `${secs.toFixed(1)}s`;
    const mins = Math.floor(secs / 60);
    const remainingSecs = (secs % 60).toFixed(0);
    return `${mins}m ${remainingSecs}s`;
  };

  const getProgressPercent = (): number => {
    if (!progress || progress.total_files === 0) return 0;
    return (progress.processed_files / progress.total_files) * 100;
  };

  const getCurrentFileName = (): string => {
    if (!progress?.current_file) return '';
    const parts = progress.current_file.split('/');
    return parts[parts.length - 1] || progress.current_file;
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
          <button onClick={handleAddFolder} className="btn-secondary flex items-center gap-2">
            <FolderPlus size={16} />
            Add Folder
          </button>
        </div>

        {/* Discovery Phase UI */}
        {scanning && discovery && !discovery.is_complete && (
          <div className="mb-4 p-4 bg-blue-600/10 border border-blue-600/20 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Loader size={16} className="animate-spin text-blue-400" />
                <span className="text-sm font-medium text-text-primary">Discovering files...</span>
              </div>
              <button
                onClick={handleCancelScan}
                className="btn-icon text-danger hover:bg-danger/10 p-1"
                title="Cancel scan"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-2xl font-bold text-blue-400">
                {discovery.files_found.toLocaleString()}
              </div>
              <div className="text-sm text-text-tertiary">audio files found</div>
            </div>

            {discovery.current_folder && (
              <p
                className="text-xs text-text-tertiary truncate mt-2"
                title={discovery.current_folder}
              >
                Searching: {discovery.current_folder.split('/').slice(-2).join('/')}
              </p>
            )}
          </div>
        )}

        {/* Scan Progress UI */}
        {scanning && progress && (
          <div className="mb-4 p-4 bg-primary-600/10 border border-primary-600/20 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-text-primary">
                Processing: {progress.processed_files.toLocaleString()} /{' '}
                {progress.total_files.toLocaleString()} files
              </span>
              <button
                onClick={handleCancelScan}
                className="btn-icon text-danger hover:bg-danger/10 p-1"
                title="Cancel scan"
              >
                <X size={16} />
              </button>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-bg-surface rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-primary-500 transition-all duration-150 ease-out"
                style={{ width: `${getProgressPercent()}%` }}
              />
            </div>

            {/* Current file */}
            <p className="text-xs text-text-tertiary truncate" title={progress.current_file}>
              {getCurrentFileName()}
            </p>
          </div>
        )}

        {/* Scan Result */}
        {scanResult && !scanning && (
          <div
            className={`mb-4 p-4 rounded-xl border ${
              scanResult.cancelled
                ? 'bg-warning/10 border-warning/20'
                : scanResult.errors > 0
                  ? 'bg-primary-600/10 border-primary-600/20'
                  : 'bg-success/10 border-success/20'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-text-primary mb-2">
                  {scanResult.cancelled ? 'Scan cancelled' : 'Scan complete'}
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <p className="text-text-secondary">
                    <span className="text-text-tertiary">Total files:</span>{' '}
                    {scanResult.total_files}
                  </p>
                  <p className="text-text-secondary">
                    <span className="text-text-tertiary">Duration:</span>{' '}
                    {formatDuration(scanResult.duration_secs)}
                  </p>
                  <p className="text-success">
                    <span className="text-text-tertiary">Scanned:</span> {scanResult.scanned}
                  </p>
                  <p className="text-text-muted">
                    <span className="text-text-tertiary">Skipped:</span> {scanResult.skipped}
                  </p>
                  {scanResult.errors > 0 && (
                    <p className="text-warning">
                      <span className="text-text-tertiary">Errors:</span> {scanResult.errors}
                    </p>
                  )}
                </div>
              </div>
              {scanResult.errors > 0 && (
                <button
                  onClick={() => setShowErrors(!showErrors)}
                  className="text-xs text-text-tertiary hover:text-text-secondary flex items-center gap-1"
                >
                  <AlertCircle size={14} />
                  {showErrors ? 'Hide errors' : 'Show errors'}
                </button>
              )}
            </div>

            {/* Error list */}
            {showErrors && scanResult.error_files.length > 0 && (
              <div className="mt-3 pt-3 border-t border-bg-surface">
                <ErrorList errorFiles={scanResult.error_files} />
              </div>
            )}
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
        <h2 className="text-xl font-semibold mb-6 text-text-primary">Appearance</h2>
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <label
                htmlFor="toggle-visualizer"
                className="block text-sm font-semibold mb-2 text-text-primary"
              >
                Audio Visualizer
              </label>
              <p className="text-sm text-text-tertiary">
                Show animated frequency bars on the album cover. Click the visualizer to open the
                equalizer.
              </p>
            </div>
            <label className="toggle-switch ml-6 flex-shrink-0">
              <input
                id="toggle-visualizer"
                type="checkbox"
                checked={visualizerEnabled}
                onChange={(e) => setVisualizerEnabled(e.target.checked)}
                aria-label="Audio Visualizer"
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {visualizerEnabled && (
            <div className="flex items-center justify-between pt-2">
              <div className="flex-1">
                <label
                  htmlFor="slider-visualizer-opacity"
                  className="block text-sm font-semibold mb-2 text-text-primary"
                >
                  Visualizer Opacity
                </label>
                <p className="text-sm text-text-tertiary">
                  Adjust the transparency of the visualizer overlay on album art
                </p>
              </div>
              <div className="flex items-center gap-3 ml-6 flex-shrink-0">
                <input
                  id="slider-visualizer-opacity"
                  type="range"
                  min={1}
                  max={100}
                  step={1}
                  value={visualizerOpacity}
                  onChange={(e) => setVisualizerOpacity(Number(e.target.value))}
                  className="w-28 accent-primary-500"
                />
                <span className="text-sm text-text-secondary w-10 text-right">
                  {visualizerOpacity}%
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="bg-bg-card rounded-2xl p-6 border border-bg-surface shadow-lg">
        <h2 className="text-xl font-semibold mb-2 text-text-primary">Table Columns</h2>
        <p className="text-sm text-text-tertiary mb-6">
          Choose which columns are visible in track tables.
        </p>
        <div className="space-y-4">
          {COLUMN_DEFINITIONS.map((col) => (
            <div key={col.id} className="flex items-center justify-between">
              <label
                htmlFor={`toggle-col-${col.id}`}
                className="text-sm font-medium text-text-primary"
              >
                {col.label}
              </label>
              <label className="toggle-switch">
                <input
                  id={`toggle-col-${col.id}`}
                  type="checkbox"
                  checked={columnVisibility[col.id]}
                  disabled={col.id === 'title'}
                  onChange={(e) => setColumnVisibility(col.id, e.target.checked)}
                  aria-label={`Toggle ${col.label} column`}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          ))}
        </div>
        <div className="mt-6 pt-4 border-t border-bg-surface">
          <button
            onClick={() => {
              resetColumnWidths();
              resetColumnVisibility();
            }}
            className="btn-secondary flex items-center gap-2"
          >
            <RotateCcw size={16} />
            Reset Column Widths
          </button>
        </div>
      </section>

      <section className="bg-bg-card rounded-2xl p-6 border border-bg-surface shadow-lg">
        <h2 className="text-xl font-semibold mb-6 text-text-primary">Metadata</h2>
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <label
                htmlFor="toggle-auto-fetch"
                className="block text-sm font-semibold mb-2 text-text-primary"
              >
                Auto-fetch metadata
              </label>
              <p className="text-sm text-text-tertiary">
                Automatically fetch metadata from MusicBrainz when scanning new tracks
              </p>
            </div>
            <label className="toggle-switch ml-6 flex-shrink-0">
              <input
                id="toggle-auto-fetch"
                type="checkbox"
                defaultChecked={false}
                aria-label="Auto-fetch metadata"
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>
      </section>

      {/* Support Section */}
      <section className="bg-gradient-to-br from-pink-600/10 to-orange-600/10 rounded-2xl p-6 border border-pink-600/20 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-pink-500/20 rounded-xl">
            <Heart size={24} className="text-pink-400" fill="currentColor" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold mb-2 text-text-primary">Support OSMP</h2>
            <p className="text-sm text-text-secondary mb-4">
              OSMP is free and open source. If you enjoy using it, consider supporting the
              development with a small donation.
            </p>
            <a
              href="https://ko-fi.com/la7"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FF5E5B] hover:bg-[#ff4744] text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-[#FF5E5B]/20 hover:shadow-[#FF5E5B]/30 hover:scale-105"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311z" />
              </svg>
              Support on Ko-fi
              <ExternalLink size={14} className="opacity-70" />
            </a>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="bg-bg-card rounded-2xl p-6 border border-bg-surface shadow-lg">
        <h2 className="text-xl font-semibold mb-4 text-text-primary">About</h2>
        <div className="space-y-2 text-sm text-text-secondary">
          <p>
            <span className="text-text-tertiary">Version:</span> 0.1.0
          </p>
          <p>
            <span className="text-text-tertiary">Built with:</span> Tauri, React, Rust
          </p>
          <p className="pt-2 text-text-tertiary">OSMP - Open Source Music Player</p>
        </div>
      </section>
    </div>
  );
}
