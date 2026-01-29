import { useState, useEffect, useCallback, useRef } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

interface AutoUpdateState {
  status: UpdateStatus;
  version: string | null;
  progress: number;
  error: string | null;
  dismissed: boolean;
}

export function useAutoUpdate() {
  const [state, setState] = useState<AutoUpdateState>({
    status: 'idle',
    version: null,
    progress: 0,
    error: null,
    dismissed: false,
  });
  const updateRef = useRef<Update | null>(null);

  const checkForUpdate = useCallback(async () => {
    setState((s) => ({ ...s, status: 'checking', error: null, dismissed: false }));
    try {
      const update = await check();
      if (update) {
        updateRef.current = update;
        setState((s) => ({
          ...s,
          status: 'available',
          version: update.version,
        }));
      } else {
        setState((s) => ({ ...s, status: 'idle' }));
      }
    } catch {
      // Silently fail — network errors, missing platforms in latest.json, etc.
      setState((s) => ({ ...s, status: 'idle' }));
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    const update = updateRef.current;
    if (!update) return;

    setState((s) => ({ ...s, status: 'downloading', progress: 0 }));
    try {
      let contentLength = 0;
      let downloaded = 0;
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength ?? 0;
            break;
          case 'Progress': {
            downloaded += event.data.chunkLength;
            const percent = contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0;
            setState((s) => ({ ...s, progress: percent }));
            break;
          }
          case 'Finished':
            setState((s) => ({ ...s, status: 'ready', progress: 100 }));
            break;
        }
      });
      setState((s) => ({ ...s, status: 'ready', progress: 100 }));
    } catch {
      setState((s) => ({ ...s, status: 'error', error: 'Download failed' }));
    }
  }, []);

  const restartApp = useCallback(async () => {
    await relaunch();
  }, []);

  const dismiss = useCallback(() => {
    setState((s) => ({ ...s, dismissed: true }));
  }, []);

  // Auto-check 5 seconds after startup
  useEffect(() => {
    const timer = setTimeout(checkForUpdate, 5000);
    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  return {
    ...state,
    checkForUpdate,
    downloadAndInstall,
    restartApp,
    dismiss,
  };
}
