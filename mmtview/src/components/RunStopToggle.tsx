import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import PrimaryButton, { usePrimaryButtonBorder } from './PrimaryButton';
import { ContextMenuItem } from './ContextMenuHost';
import { useAccentChrome } from '../shared/useAccentChrome';

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

function SplitLabel({ icon, label, spin }: { icon: string; label: string; spin?: boolean }) {
  return (
    <>
      <span
        className={['codicon', `codicon-${icon}`, spin ? 'codicon-modifier-spin' : ''].filter(Boolean).join(' ')}
        aria-hidden
      />
      <span>{label}</span>
    </>
  );
}

/**
 * Shared Run ↔ Starting ↔ Stop primary control used on test / suite / mock run pages.
 * With a More menu, Run in Core opens from that button. The control keeps one
 * footprint, and while a run is active the whole control is the stop action.
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
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  const [hover, setHover] = useState(false);
  const showSplit = Boolean(runContextMenuItems?.length);
  const menuAvailable = showSplit && !running && !preparing && !disabled;
  const openMenu = Boolean(menuPos && menuAvailable);
  const runningChrome = useAccentChrome('red', { fillAmount: hover ? 62 : 52 });
  const idleBorder = usePrimaryButtonBorder(running ? runningChrome.border : null);

  const closeMenu = useCallback(() => setMenuPos(null), []);

  const openMenuNearButton = useCallback(() => {
    const anchor = wrapperRef.current;
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

  if (!showSplit) {
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

  const busy = running || preparing;
  const mainIcon = busy ? 'loading' : 'run';
  const mainLabel = running ? stopLabel : preparing ? preparingLabel : runLabel;
  const mainTitle = running
    ? (stopTitle || stopLabel)
    : preparing
      ? (preparingTitle || preparingLabel)
      : (runTitle || runLabel);

  const menu = openMenu && menuPos ? (
    <div
      ref={menuRef}
      role="menu"
      className="run-split-menu"
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
      <span
        ref={wrapperRef}
        className={[
          'run-ctl',
          running ? 'is-running' : '',
          preparing ? 'is-preparing' : '',
          disabled && !busy ? 'is-disabled' : '',
        ].filter(Boolean).join(' ')}
        style={running
          ? {
              ['--run-fill' as string]: runningChrome.fill,
              ['--run-fill-hover' as string]: runningChrome.fill,
              ['--run-ink' as string]: runningChrome.onFill,
              ['--run-line' as string]: runningChrome.border,
            }
          : { ['--run-line' as string]: idleBorder }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <button
          type="button"
          className="run-ctl-main"
          disabled={preparing || (!running && disabled)}
          title={mainTitle}
          onClick={() => {
            if (running) {
              onStop();
              return;
            }
            if (!preparing && !disabled) {
              void onRun();
            }
          }}
        >
          <span className="run-split-sizer" aria-hidden>
            <span className="run-split-measure">
              <SplitLabel icon="run" label={runLabel} />
            </span>
            <span className="run-split-measure">
              <SplitLabel icon="loading" label={preparingLabel} />
            </span>
            <span className="run-split-measure">
              <SplitLabel icon="loading" label={stopLabel} />
            </span>
          </span>
          <span className="run-split-current">
            <SplitLabel icon={mainIcon} label={mainLabel} spin={busy} />
          </span>
        </button>
        <span className={`run-ctl-sep${busy ? ' is-hidden' : ''}`} aria-hidden />
        {busy ? (
          <button
            type="button"
            className="run-ctl-more"
            tabIndex={-1}
            aria-hidden
            disabled={preparing}
            title={running ? mainTitle : undefined}
            onClick={() => {
              if (running) {
                onStop();
              }
            }}
          >
            <span className="codicon codicon-chevron-down" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            className={`run-ctl-more${openMenu ? ' is-open' : ''}`}
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
        )}
        {busy ? (
          <span className="run-ctl-center" aria-hidden>
            <SplitLabel icon={mainIcon} label={mainLabel} spin />
          </span>
        ) : null}
      </span>
      {menu ? ReactDOM.createPortal(menu, document.body) : null}
    </>
  );
}
