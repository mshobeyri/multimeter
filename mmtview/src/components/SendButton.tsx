import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import ReactDOM from "react-dom";
import { accentChromeFor, harmonizeAccent, resolveAccent, SEMANTIC_COLORS } from "../shared/themeAccent";
import { sendShortcutLabel } from "../primaryAction";

export type SendButtonMenuItem = {
  label: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
};

/** Menu entry: clickable item or a non-interactive section heading (like body format RAW / YAML-encoded). */
export type SendButtonMenuEntry =
  | ({ kind: "heading"; label: string })
  | (SendButtonMenuItem & { kind?: "item" });

/** `send` = API Send/Cancel; `run` = test/suite Run/Stop (same control chrome). */
export type SendButtonMode = "send" | "run";

const DEFAULT_SEND_ACCENT = SEMANTIC_COLORS.green;
const DISABLED_ACCENT = "#7a7979";
const MAIN_SIZE = 28;
const SEND_SEGMENT_WIDTH = 34;
const MENU_SEGMENT_WIDTH = 20;
const DEFAULT_CANCEL_REVEAL_MS: Record<SendButtonMode, number> = {
  send: 500,
  run: 500,
};

/** Delay before the oversized load circle appears (no size animation). */
const LOAD_DISC_DELAY_MS = 50;

/**
 * Match `.codicon-loading` + `.codicon-modifier-spin` (see vendor/codicons/codicon.css):
 * base spin keyframes, 1s duration, loading easing (not linear / not 1.5s steps).
 */
const LOAD_ROTATOR_ANIMATION =
  "codicon-spin 1s cubic-bezier(0.53, 0.21, 0.29, 0.67) infinite";

const SendButton: React.FC<{
  onClick: () => void;
  onCancel?: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Brand/method accent; harmonized with the active VS Code theme. */
  accent?: string;
  contextMenuItems?: SendButtonMenuEntry[];
  /**
   * Visual/action variant. `run` uses run/stop icons; cancel/stop reveal is
   * 500ms unless `cancelRevealMs` overrides.
   */
  mode?: SendButtonMode;
  /** Delay before the loading control becomes cancel/stop. */
  cancelRevealMs?: number;
  /** Idle tooltip (defaults: Send shortcut / Run). */
  actionTitle?: string;
  /** Active/cancel tooltip (defaults: Cancel / Stop). */
  cancelTitle?: string;
}> = ({
  onClick,
  onCancel,
  disabled,
  loading,
  accent = DEFAULT_SEND_ACCENT,
  contextMenuItems,
  mode = "send",
  cancelRevealMs,
  actionTitle,
  cancelTitle,
}) => {
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  const [themeTick, setThemeTick] = useState(0);
  const [showLoadDisc, setShowLoadDisc] = useState(false);
  const hasMenu = Boolean(contextMenuItems?.length);
  const openMenu = Boolean(menuPos && hasMenu);
  const revealMs = cancelRevealMs ?? DEFAULT_CANCEL_REVEAL_MS[mode];
  const idleIcon = mode === "run" ? "codicon-run" : "codicon-send";
  const cancelIcon = mode === "run" ? "codicon-debug-stop" : "codicon-close";
  const idleTitle =
    actionTitle ?? (mode === "run" ? "Run" : `Send (${sendShortcutLabel()})`);
  const activeTitle = cancelTitle ?? (mode === "run" ? "Stop" : "Cancel");

  useEffect(() => {
    const onTheme = () => setThemeTick((n) => n + 1);
    window.addEventListener("vscode:changeColorTheme", onTheme as EventListener);
    return () => window.removeEventListener("vscode:changeColorTheme", onTheme as EventListener);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (loading) {
      timer = setTimeout(() => {
        setShowCancel(true);
      }, revealMs);
    } else {
      setShowCancel(false);
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [loading, revealMs]);

  useEffect(() => {
    if (!loading) {
      setShowLoadDisc(false);
      return;
    }
    const timer = setTimeout(() => {
      setShowLoadDisc(true);
    }, LOAD_DISC_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [loading]);

  const sendChrome = useMemo(
    () => harmonizeAccent(resolveAccent(accent), { fillAmount: hover ? 62 : 52 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accent, hover, themeTick],
  );
  const cancelChrome = useMemo(
    () => accentChromeFor("red", { fillAmount: hover ? 62 : 52 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hover, themeTick],
  );
  const disabledChrome = useMemo(
    () => harmonizeAccent(DISABLED_ACCENT, { fillAmount: 40 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [themeTick],
  );
  const activeChrome = disabled
    ? disabledChrome
    : showCancel
      ? cancelChrome
      : sendChrome;

  const handleClick = () => {
    if (showCancel && onCancel) {
      onCancel();
    } else if (!disabled) {
      onClick();
    }
  };

  const openMenuAt = useCallback((clientX: number, clientY: number) => {
    if (!contextMenuItems?.length) {
      return;
    }
    const menuWidth = 180;
    const margin = 8;
    const left = Math.min(
      Math.max(margin, clientX),
      window.innerWidth - menuWidth - margin
    );
    const top = Math.min(
      Math.max(margin, clientY),
      window.innerHeight - margin
    );
    setMenuPos({ left, top });
  }, [contextMenuItems?.length]);

  const openMenuNearButton = useCallback(() => {
    const anchor = wrapperRef.current ?? menuTriggerRef.current ?? btnRef.current;
    if (!anchor || !contextMenuItems?.length) {
      return;
    }
    const rect = anchor.getBoundingClientRect();
    openMenuAt(rect.left, rect.bottom + 4);
  }, [contextMenuItems?.length, openMenuAt]);

  const toggleMenuFromTrigger = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!contextMenuItems?.length) {
      return;
    }
    if (openMenu) {
      setMenuPos(null);
      return;
    }
    openMenuNearButton();
  };

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
      setMenuPos(null);
    };
    const closeMenu = () => setMenuPos(null);

    document.addEventListener("mousedown", handleClickOutside, true);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu, true);
    };
  }, [openMenu]);

  const menu = openMenu && menuPos ? (
    <div
      ref={menuRef}
      role="menu"
      className="send-button-menu apitest-body-format-raw-menu is-portal"
      style={{
        left: menuPos.left,
        top: menuPos.top,
        minWidth: 180,
      }}
      onClick={(event) => event.stopPropagation()}
    >
      {(() => {
        let underHeading = false;
        return contextMenuItems?.map((entry, index) => {
          if (entry.kind === "heading") {
            underHeading = true;
            return (
              <div
                key={`heading-${entry.label}-${index}`}
                className="apitest-body-format-raw-heading"
                role="presentation"
              >
                {entry.label}
              </div>
            );
          }
          const item = entry;
          return (
            <button
              key={`${item.label}-${index}`}
              type="button"
              role="menuitem"
              className={[
                "apitest-body-format-raw-option",
                underHeading ? "is-group-child" : "",
              ].filter(Boolean).join(" ")}
              disabled={item.disabled}
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => {
                event.stopPropagation();
                if (!item.disabled) {
                  setMenuPos(null);
                  item.onClick();
                }
              }}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && !item.disabled) {
                  event.preventDefault();
                  setMenuPos(null);
                  item.onClick();
                }
              }}
            >
              {item.icon && <span className={`codicon ${item.icon}`} />}
              {item.label}
            </button>
          );
        });
      })()}
    </div>
  ) : null;

  // Slightly oversized circular disc + rotator sit outside the pill clip.
  // Shown after a short delay; no size animation. Icon uses a fixed slot.
  const sendSegmentWidth = hasMenu ? SEND_SEGMENT_WIDTH : MAIN_SIZE;
  const ringSize = MAIN_SIZE + 8;
  const loadingRing = showLoadDisc ? (
    <span
      aria-hidden
      style={{
        position: "absolute",
        left: (sendSegmentWidth - ringSize) / 2,
        top: (MAIN_SIZE - ringSize) / 2,
        width: ringSize,
        height: ringSize,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 3,
      }}
    >
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: activeChrome.fill,
          border: `1px solid ${activeChrome.border}`,
          boxShadow: activeChrome.outline ? "none" : "0 2px 6px #0001",
          transition: "background-color 0.5s ease, border-color 0.5s ease",
        }}
      />
      <svg
        width={ringSize}
        height={ringSize}
        viewBox={`0 0 ${ringSize} ${ringSize}`}
        style={{
          position: "relative",
          animation: LOAD_ROTATOR_ANIMATION,
        }}
      >
        <circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={(ringSize / 2) - 2}
          fill="none"
          stroke={activeChrome.onFill}
          strokeWidth="3"
          strokeDasharray="44"
          strokeDashoffset="12"
          strokeLinecap="round"
          opacity="0.7"
        />
      </svg>
    </span>
  ) : null;

  const faceIcon = (
    <span
      aria-hidden
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: sendSegmentWidth,
        height: MAIN_SIZE,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 4,
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          flex: "0 0 16px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          className={`codicon ${showCancel ? cancelIcon : idleIcon}`}
          style={{
            fontSize: "16px",
            lineHeight: 1,
            color: activeChrome.onFill,
          }}
        />
      </span>
    </span>
  );

  return (
    <>
      <span
        ref={wrapperRef}
        data-mmt-coach="send"
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "stretch",
          height: MAIN_SIZE,
          overflow: "visible",
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-haspopup={hasMenu ? "menu" : undefined}
        aria-expanded={openMenu || undefined}
      >
        <span
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "stretch",
            height: MAIN_SIZE,
            borderRadius: hasMenu ? MAIN_SIZE / 2 : "50%",
            overflow: "hidden",
            background: activeChrome.fill,
            border: `1px solid ${activeChrome.border}`,
            boxShadow: activeChrome.outline ? "none" : "0 2px 6px #0001",
            transition: "background-color 0.5s ease, border-color 0.5s ease",
          }}
        >
          <button
            ref={btnRef}
            style={{
              background: "transparent",
              color: activeChrome.onFill,
              border: "none",
              borderRadius: hasMenu
                ? `${MAIN_SIZE / 2}px 0 0 ${MAIN_SIZE / 2}px`
                : "50%",
              width: sendSegmentWidth,
              height: MAIN_SIZE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: disabled ? "not-allowed" : "pointer",
              padding: 0,
              position: "relative",
              flex: "0 0 auto",
              outline: "none",
            }}
            title={showCancel ? activeTitle : idleTitle}
            aria-label={showCancel ? activeTitle : idleTitle}
            onClick={handleClick}
            disabled={disabled}
          />
          {hasMenu ? (
            <>
              <span
                aria-hidden
                style={{
                  width: 1,
                  alignSelf: "stretch",
                  margin: "5px 0",
                  background: `color-mix(in srgb, ${activeChrome.onFill} 45%, transparent)`,
                  flex: "0 0 auto",
                }}
              />
              <button
                ref={menuTriggerRef}
                type="button"
                title="More"
                aria-label="More"
                aria-haspopup="menu"
                aria-expanded={openMenu}
                onClick={toggleMenuFromTrigger}
                onMouseDown={(event) => event.stopPropagation()}
                style={{
                  background: "transparent",
                  color: activeChrome.onFill,
                  border: "none",
                  borderRadius: `0 ${MAIN_SIZE / 2}px ${MAIN_SIZE / 2}px 0`,
                  width: MENU_SEGMENT_WIDTH,
                  height: MAIN_SIZE,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  margin: 0,
                  cursor: "pointer",
                  flex: "0 0 auto",
                  outline: "none",
                }}
              >
                <span
                  className="codicon codicon-chevron-down"
                  style={{
                    fontSize: "12px",
                    color: activeChrome.onFill,
                    lineHeight: 1,
                  }}
                  aria-hidden
                />
              </button>
            </>
          ) : null}
        </span>
        {loadingRing}
        {faceIcon}
      </span>
      {menu && ReactDOM.createPortal(menu, document.body)}
    </>
  );
};

export default SendButton;
