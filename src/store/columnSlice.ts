import { StateCreator } from 'zustand';
import type { AppState, ColumnSlice } from './types';
import type { ContentColumnId } from '../types/columns';
import {
  COLUMN_DEFINITIONS,
  DEFAULT_COLUMN_WIDTHS,
  DEFAULT_COLUMN_VISIBILITY,
  COLUMN_STORAGE_KEY,
  COLUMN_VISIBILITY_STORAGE_KEY,
} from '../constants';

function loadColumnWidths(): Record<ContentColumnId, number> {
  try {
    const stored = localStorage.getItem(COLUMN_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_COLUMN_WIDTHS, ...parsed };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_COLUMN_WIDTHS };
}

function loadColumnVisibility(): Record<ContentColumnId, boolean> {
  try {
    const stored = localStorage.getItem(COLUMN_VISIBILITY_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_COLUMN_VISIBILITY, ...parsed, title: true };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_COLUMN_VISIBILITY };
}

export const createColumnSlice: StateCreator<AppState, [], [], ColumnSlice> = (set) => ({
  columnWidths: loadColumnWidths(),
  columnVisibility: loadColumnVisibility(),

  setColumnWidth: (columnId: ContentColumnId, width: number) => {
    const col = COLUMN_DEFINITIONS.find((c) => c.id === columnId);
    const minWidth = col?.minWidth ?? 60;
    const clampedWidth = Math.max(minWidth, width);

    set((state) => {
      const newWidths = { ...state.columnWidths, [columnId]: clampedWidth };
      localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(newWidths));
      return { columnWidths: newWidths };
    });
  },

  setColumnVisibility: (columnId: ContentColumnId, visible: boolean) => {
    // Title is always visible
    if (columnId === 'title') return;

    set((state) => {
      const newVisibility = { ...state.columnVisibility, [columnId]: visible };
      localStorage.setItem(COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(newVisibility));
      return { columnVisibility: newVisibility };
    });
  },

  resetColumnWidths: () => {
    const defaults = { ...DEFAULT_COLUMN_WIDTHS };
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(defaults));
    set({ columnWidths: defaults });
  },

  resetColumnVisibility: () => {
    const defaults = { ...DEFAULT_COLUMN_VISIBILITY };
    localStorage.setItem(COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(defaults));
    set({ columnVisibility: defaults });
  },
});
