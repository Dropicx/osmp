import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStore } from '../index';
import {
  DEFAULT_COLUMN_WIDTHS,
  DEFAULT_COLUMN_VISIBILITY,
  COLUMN_STORAGE_KEY,
  COLUMN_VISIBILITY_STORAGE_KEY,
} from '../../constants';

vi.mock('@tauri-apps/api/core');
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

describe('columnSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useStore.setState({
      columnWidths: { ...DEFAULT_COLUMN_WIDTHS },
      columnVisibility: { ...DEFAULT_COLUMN_VISIBILITY },
    });
  });

  describe('setColumnWidth', () => {
    it('sets width for a column', () => {
      useStore.getState().setColumnWidth('title', 300);
      expect(useStore.getState().columnWidths.title).toBe(300);
    });

    it('clamps to minimum width', () => {
      // title has minWidth 120
      useStore.getState().setColumnWidth('title', 50);
      expect(useStore.getState().columnWidths.title).toBe(120);
    });

    it('persists to localStorage', () => {
      useStore.getState().setColumnWidth('artist', 250);
      const stored = JSON.parse(localStorage.getItem(COLUMN_STORAGE_KEY) || '{}');
      expect(stored.artist).toBe(250);
    });

    it('uses default minWidth of 60 for unknown columns', () => {
      // duration has minWidth 70
      useStore.getState().setColumnWidth('duration', 50);
      expect(useStore.getState().columnWidths.duration).toBe(70);
    });
  });

  describe('setColumnVisibility', () => {
    it('sets visibility for a column', () => {
      useStore.getState().setColumnVisibility('genre', false);
      expect(useStore.getState().columnVisibility.genre).toBe(false);
    });

    it('prevents hiding title column', () => {
      useStore.getState().setColumnVisibility('title', false);
      expect(useStore.getState().columnVisibility.title).toBe(true);
    });

    it('persists to localStorage', () => {
      useStore.getState().setColumnVisibility('album', false);
      const stored = JSON.parse(localStorage.getItem(COLUMN_VISIBILITY_STORAGE_KEY) || '{}');
      expect(stored.album).toBe(false);
    });
  });

  describe('resetColumnWidths', () => {
    it('resets to defaults', () => {
      useStore.getState().setColumnWidth('title', 500);
      useStore.getState().resetColumnWidths();
      expect(useStore.getState().columnWidths).toEqual(DEFAULT_COLUMN_WIDTHS);
    });

    it('persists defaults to localStorage', () => {
      useStore.getState().resetColumnWidths();
      const stored = JSON.parse(localStorage.getItem(COLUMN_STORAGE_KEY) || '{}');
      expect(stored).toEqual(DEFAULT_COLUMN_WIDTHS);
    });
  });

  describe('resetColumnVisibility', () => {
    it('resets to defaults', () => {
      useStore.getState().setColumnVisibility('genre', false);
      useStore.getState().resetColumnVisibility();
      expect(useStore.getState().columnVisibility).toEqual(DEFAULT_COLUMN_VISIBILITY);
    });

    it('persists defaults to localStorage', () => {
      useStore.getState().resetColumnVisibility();
      const stored = JSON.parse(localStorage.getItem(COLUMN_VISIBILITY_STORAGE_KEY) || '{}');
      expect(stored).toEqual(DEFAULT_COLUMN_VISIBILITY);
    });
  });
});
