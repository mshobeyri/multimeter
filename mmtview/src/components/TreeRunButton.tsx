import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { runInCoreMenuItem } from './ContextMenuHost';

export type TreeRunButtonProps = {
  onRun?: () => void | Promise<void>;
  /** Logs-only run (opens output channel via menu helper). */
  onRunInCore?: () => void | Promise<void>;
  title?: string;
  disabled?: boolean;
};

/**
 * Compact icon run control for suite/test tree rows.
 * Uses ghost `.action-button` — not `.tab-button` (tabs are for navigation).
 */
export default function TreeRunButton({
  onRun,
  onRunInCore,
  title = 'Run',
  disabled = false,
}: TreeRunButtonProps) {
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  const openMenu = Boolean(menuPos) && !disabled;

  const closeMenu = useCallback(() => setMenuPos(null), []);

  const openMenuNearButton = useCallback(() => {
    const anchor = wrapperRef.current;
    if (!anchor) {
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const menuWidth = 180;
    const margin = 8;
    const left = Math.min(
      Math.max(margin, rect.left),
      window.innerWidth - menuWidth - margin,
    );
    const top = Math.min(
      Math.max(margin, rect.bottom + 4),
      window.innerHeight - margin,
    );
    setMenuPos({ left, top });
  }, []);

  useEffect(() => {
    if (!openMenu) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;
      if (!target) {
        return;
      }
      if (menuRef.current?.contains(target as Node)) {
        return;
      }
      if (wrapperRef.current?.contains(target as Node)) {
        return;
      }
      closeMenu();
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('resize', closeMenu, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('resize', closeMenu, true);
    };
  }, [openMenu, closeMenu]);

  if (!onRun) {
    return null;
  }

  const coreHandler = onRunInCore || onRun;
  const item = runInCoreMenuItem(coreHandler);

  const menu = openMenu && menuPos ? (
    <div
      ref={menuRef}
      role="menu"
      className="run-split-menu"
      style={{ left: menuPos.left, top: menuPos.top }}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        role="menuitem"
        className="action-button"
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => {
          event.stopPropagation();
          closeMenu();
          void item.onClick();
        }}
      >
        {item.icon && <span className={`codicon ${item.icon}`} />}
        {item.label}
      </button>
    </div>
  ) : null;

  return (
    <>
      <span ref={wrapperRef} className="tree-run-split">
        <button
          className="action-button tree-run-button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void onRun();
          }}
          title={title}
          disabled={disabled}
          type="button"
        >
          <span className="codicon codicon-run" aria-hidden />
        </button>
        <button
          className="action-button tree-run-more"
          type="button"
          title="More"
          aria-label="More"
          aria-haspopup="menu"
          aria-expanded={openMenu}
          disabled={disabled}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (openMenu) {
              closeMenu();
              return;
            }
            openMenuNearButton();
          }}
        >
          <span className="codicon codicon-chevron-down" aria-hidden />
        </button>
      </span>
      {menu ? ReactDOM.createPortal(menu, document.body) : null}
    </>
  );
}
