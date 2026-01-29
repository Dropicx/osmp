import { describe, it, expect, vi, beforeEach } from 'vitest';
import { showToast, onToast, invokeCommand } from '../errorHandler';
import type { Toast } from '../errorHandler';

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('showToast', () => {
    it('notifies all listeners with toast object', () => {
      const listener = vi.fn();
      const unsub = onToast(listener);

      showToast('Something went wrong', 'error');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Something went wrong',
          level: 'error',
        })
      );
      unsub();
    });

    it('defaults level to error', () => {
      const listener = vi.fn();
      const unsub = onToast(listener);

      showToast('fail');

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ level: 'error' }));
      unsub();
    });

    it('supports warning and info levels', () => {
      const listener = vi.fn();
      const unsub = onToast(listener);

      showToast('warning message', 'warning');
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ level: 'warning' }));

      showToast('info message', 'info');
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ level: 'info' }));
      unsub();
    });

    it('assigns incrementing ids', () => {
      const toasts: Toast[] = [];
      const unsub = onToast((t) => toasts.push(t));

      showToast('first');
      showToast('second');

      expect(toasts[1].id).toBeGreaterThan(toasts[0].id);
      unsub();
    });
  });

  describe('onToast', () => {
    it('returns an unsubscribe function', () => {
      const listener = vi.fn();
      const unsub = onToast(listener);

      showToast('before unsub');
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      showToast('after unsub');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('supports multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const unsub1 = onToast(listener1);
      const unsub2 = onToast(listener2);

      showToast('hello');

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);

      unsub1();
      unsub2();
    });
  });

  describe('invokeCommand', () => {
    it('returns the result on success', async () => {
      const result = await invokeCommand(() => Promise.resolve(42));
      expect(result).toBe(42);
    });

    it('returns null and shows toast on error', async () => {
      const listener = vi.fn();
      const unsub = onToast(listener);

      const result = await invokeCommand(() => Promise.reject('Database lock error'));

      expect(result).toBeNull();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'The database is temporarily busy. Please try again.',
          level: 'error',
        })
      );
      unsub();
    });

    it('maps known error messages', async () => {
      const listener = vi.fn();
      const unsub = onToast(listener);

      await invokeCommand(() => Promise.reject('Track not found'));
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'The selected track could not be found.',
        })
      );

      await invokeCommand(() => Promise.reject('Playlist not found'));
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'The selected playlist could not be found.',
        })
      );

      await invokeCommand(() => Promise.reject('Failed to open file'));
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Could not open the audio file. It may have been moved or deleted.',
        })
      );

      await invokeCommand(() => Promise.reject('Failed to decode audio'));
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Could not play this file. The format may not be supported.',
        })
      );

      await invokeCommand(() => Promise.reject('No tracks found in album'));
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'This album has no playable tracks.',
        })
      );

      await invokeCommand(() => Promise.reject('Playlist is empty'));
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'This playlist has no tracks to play.',
        })
      );

      await invokeCommand(() => Promise.reject('Band index must be 0-4'));
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid equalizer band.',
        })
      );

      await invokeCommand(() => Promise.reject('Gain must be between -12 and 12'));
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'EQ gain must be between -12 and +12 dB.',
        })
      );

      await invokeCommand(() => Promise.reject('Speed must be between 0.25 and 4'));
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Playback speed must be between 0.25x and 4.0x.',
        })
      );

      unsub();
    });

    it('falls back to generic message for unknown errors', async () => {
      const listener = vi.fn();
      const unsub = onToast(listener);

      await invokeCommand(() => Promise.reject('something totally unknown'));

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('An unexpected error occurred'),
        })
      );
      unsub();
    });

    it('passes through error string containing "error"', async () => {
      const listener = vi.fn();
      const unsub = onToast(listener);

      await invokeCommand(() => Promise.reject('Some error happened'));

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Some error happened',
        })
      );
      unsub();
    });

    it('does not show toast when silent option is true', async () => {
      const listener = vi.fn();
      const unsub = onToast(listener);

      await invokeCommand(() => Promise.reject('Track not found'), { silent: true });

      expect(listener).not.toHaveBeenCalled();
      unsub();
    });

    it('prepends context to error message', async () => {
      const listener = vi.fn();
      const unsub = onToast(listener);

      await invokeCommand(() => Promise.reject('Track not found'), {
        context: 'Loading library',
      });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Loading library: The selected track could not be found.',
        })
      );
      unsub();
    });
  });
});
