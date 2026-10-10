import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import PrimaryButton from './PrimaryButton';
import { ContextMenuItem } from './ContextMenuHost';

export type RunStopToggleProps = {
  running: boolean;
  /**
   * Local prep before the host run starts (yaml serialize, hierarchy fetch, …).
   * Shows a non-reentrant Starting control so the user does not click Run again.
   */
  preparing?: boolean;
  onRun: () => void | Promise<void>;
  onStop: () => void;
  /** Label while idle. Default "Run". */
  runLabel?: string;
  /** Label while preparing. Default "Starting…". */
  preparingLabel?: string;
  /** Label while running. Default "Stop". */
  stopLabel?: string;
  runTitle?: string;
  preparingTitle?: string;
  stopTitle?: string;
  disabled?: boolean;
  /** Extra actions shown from the More button next to Run (e.g. Run in Core). */
  runContextMenuItems?: ContextMenuItem[];
};

/**
 * Shared Run ↔ Starting ↔ Stop primary control used on test / suite / mock run pages.
 * When menu items are provided, idle state shows a joined Run + More pair.
 */
export default function RunStopToggle({
  running,
  preparing = false,
  onRun,
  onStop,
  runLabel = 'Run',
  preparingLabel = 'Starting…',
  stopLabel = 'Stop',
  runTitle,
  preparingTitle,
  stopTitle,
  disabled,
  runContextMenuItems,
}: RunStopToggleProps) {
  const groupRef = useRef<HTMLSpanElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  const showMore = Boolean(runContextMenuItems?.length) && !running && !preparing;
  const openMenu = Boolean(menuPos && showMore && !disabled);

  const closeMenu = useCallback(() => setMenuPos(null), []);

  const openMenuNearButton = useCallback(() => {
    const anchor = groupRef.current;
    if (!anchor || !runContextMenuItems?.length) {
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
  }, [runContextMenuItems?.length]);

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
      if (groupRef.current?.contains(target as Node)) {
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

  if (running) {
    return (
      <PrimaryButton
        className="run-toggle-button"
        icon="debug-stop"
        accent="red"
        onClick={onStop}
        title={stopTitle || stopLabel}
      >
        {stopLabel}
      </PrimaryButton>
    );
  }

  if (preparing) {
    return (
      <PrimaryButton
        className="run-toggle-button"
        icon="loading"
        iconSpin
        disabled
        title={preparingTitle || preparingLabel}
      >
        {preparingLabel}
      </PrimaryButton>
    );
  }

  if (!showMore) {
    return (
      <PrimaryButton
        className="run-toggle-button"
        icon="run"
        onClick={onRun}
        disabled={disabled}
        title={runTitle || runLabel}
      >
        {runLabel}
      </PrimaryButton>
    );
  }

  const menu = openMenu && menuPos ? (
    <div
      ref={menuRef}
      role="menu"
      className="run-toggle-menu"
      style={{ left: menuPos.left, top: menuPos.top }}
      onClick={(event) => event.stopPropagation()}
    >
      {runContextMenuItems?.map(item => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className="action-button"
          disabled={item.disabled}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => {
            event.stopPropagation();
            if (!item.disabled) {
              closeMenu();
              void item.onClick();
            }
          }}
          onKeyDown={(event) => {
            if ((event.key === 'Enter' || event.key === ' ') && !item.disabled) {
              event.preventDefault();
              closeMenu();
              void item.onClick();
            }
          }}
        >
          {item.icon && <span className={`codicon ${item.icon}`} />}
          {item.label}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <>
      <span ref={groupRef} className="run-toggle-group">
        <PrimaryButton
          className="run-toggle-button run-toggle-main"
          icon="run"
          onClick={onRun}
          disabled={disabled}
          title={runTitle || runLabel}
        >
          {runLabel}
        </PrimaryButton>
        <PrimaryButton
          className="run-toggle-button run-toggle-more"
          icon="chevron-down"
          disabled={disabled}
          title="More"
          aria-label="More"
          aria-haspopup="menu"
          aria-expanded={openMenu}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (openMenu) {
              closeMenu();
              return;
            }
            openMenuNearButton();
          }}
        />
      </span>
      {menu ? ReactDOM.createPortal(menu, document.body) : null}
    </>
  );
}
