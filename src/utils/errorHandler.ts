/**
 * Centralized error handling for Tauri command invocations.
 * Maps backend error strings to user-friendly messages.
 */

type ToastLevel = 'error' | 'warning' | 'info';

interface Toast {
  message: string;
  level: ToastLevel;
  id: number;
}

let toastId = 0;
let toastListeners: Array<(toast: Toast) => void> = [];

// Error message mappings
const ERROR_MESSAGES: Record<string, string> = {
  'Database lock error': 'The database is temporarily busy. Please try again.',
  'Track not found': 'The selected track could not be found.',
  'Playlist not found': 'The selected playlist could not be found.',
  'Failed to open file': 'Could not open the audio file. It may have been moved or deleted.',
  'Failed to decode audio': 'Could not play this file. The format may not be supported.',
  'No tracks found in album': 'This album has no playable tracks.',
  'Playlist is empty': 'This playlist has no tracks to play.',
  'Band index must be 0-4': 'Invalid equalizer band.',
  'Gain must be between': 'EQ gain must be between -12 and +12 dB.',
  'Speed must be between': 'Playback speed must be between 0.25x and 4.0x.',
};

function mapErrorMessage(error: unknown): string {
  const errorStr = String(error);

  for (const [key, message] of Object.entries(ERROR_MESSAGES)) {
    if (errorStr.includes(key)) {
      return message;
    }
  }

  // Generic fallback
  if (errorStr.includes('error')) {
    return errorStr;
  }

  return `An unexpected error occurred: ${errorStr}`;
}

/**
 * Show a toast notification. Components can subscribe via onToast().
 */
export function showToast(message: string, level: ToastLevel = 'error') {
  const toast: Toast = { message, level, id: ++toastId };
  toastListeners.forEach((listener) => listener(toast));
}

/**
 * Subscribe to toast events. Returns an unsubscribe function.
 */
export function onToast(listener: (toast: Toast) => void): () => void {
  toastListeners.push(listener);
  return () => {
    toastListeners = toastListeners.filter((l) => l !== listener);
  };
}

/**
 * Wrapper for async operations with error handling.
 * Catches errors, maps to user-friendly messages, and optionally shows a toast.
 */
export async function invokeCommand<T>(
  fn: () => Promise<T>,
  options: { silent?: boolean; context?: string } = {}
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    const message = mapErrorMessage(error);
    if (!options.silent) {
      showToast(options.context ? `${options.context}: ${message}` : message, 'error');
    }
    return null;
  }
}

export type { Toast, ToastLevel };
