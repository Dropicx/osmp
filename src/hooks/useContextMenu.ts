import { useState, useEffect, useCallback } from 'react';
import { CONTEXT_MENU_WIDTH, CONTEXT_MENU_HEIGHT, CONTEXT_MENU_PADDING } from '../constants';

export interface ContextMenuState {
  x: number;
  y: number;
  trackId: number;
}

/**
 * Hook for context menu positioning and lifecycle management.
 * Handles viewport boundary clamping, click-outside dismiss, scroll dismiss, and Escape key.
 */
export function useContextMenu(menuHeight = CONTEXT_MENU_HEIGHT) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    if (!contextMenu) return;

    const handleClick = () => setContextMenu(null);
    const handleScroll = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('scroll', handleScroll, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  const getMenuPosition = useCallback(() => {
    if (!contextMenu) return { left: 0, top: 0 };

    let x = contextMenu.x;
    let y = contextMenu.y;

    if (x + CONTEXT_MENU_WIDTH + CONTEXT_MENU_PADDING > window.innerWidth) {
      x = window.innerWidth - CONTEXT_MENU_WIDTH - CONTEXT_MENU_PADDING;
    }
    if (y + menuHeight + CONTEXT_MENU_PADDING > window.innerHeight) {
      y = window.innerHeight - menuHeight - CONTEXT_MENU_PADDING;
    }

    return { left: x, top: y };
  }, [contextMenu, menuHeight]);

  const openContextMenu = useCallback((e: React.MouseEvent, trackId: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, trackId });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  return {
    contextMenu,
    getMenuPosition,
    openContextMenu,
    closeContextMenu,
  };
}
