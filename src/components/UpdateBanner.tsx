import { Download, RefreshCw, X, Loader } from 'lucide-react';
import { useAutoUpdate } from '../hooks/useAutoUpdate';

export default function UpdateBanner() {
  const { status, version, progress, dismissed, downloadAndInstall, restartApp, dismiss } =
    useAutoUpdate();

  if (dismissed || status === 'idle' || status === 'checking' || status === 'error') {
    return null;
  }

  return (
    <div className="mx-8 mt-8 mb-0 p-4 bg-primary-600/10 border border-primary-600/20 rounded-xl flex items-center gap-4">
      {status === 'available' && (
        <>
          <div className="flex-1 text-sm text-text-primary">
            <span className="font-medium">Update available:</span> v{version}
          </div>
          <button
            onClick={downloadAndInstall}
            className="btn-primary flex items-center gap-2 text-sm px-4 py-2"
          >
            <Download size={14} />
            Update
          </button>
          <button
            onClick={dismiss}
            className="btn-icon text-text-tertiary hover:text-text-secondary p-1"
            title="Dismiss"
          >
            <X size={16} />
          </button>
        </>
      )}

      {status === 'downloading' && (
        <>
          <Loader size={16} className="animate-spin text-primary-400 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm text-text-primary mb-1">Downloading update... {progress}%</div>
            <div className="w-full h-1.5 bg-bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 transition-all duration-150 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </>
      )}

      {status === 'ready' && (
        <>
          <div className="flex-1 text-sm text-text-primary">
            <span className="font-medium">Update ready.</span> Restart to apply v{version}.
          </div>
          <button
            onClick={restartApp}
            className="btn-primary flex items-center gap-2 text-sm px-4 py-2"
          >
            <RefreshCw size={14} />
            Restart
          </button>
        </>
      )}
    </div>
  );
}
