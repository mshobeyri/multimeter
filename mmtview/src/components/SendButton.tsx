import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import ReactDOM from "react-dom";
import { accentChromeFor, harmonizeAccent, resolveAccent, SEMANTIC_COLORS } from "../shared/themeAccent";

export type SendButtonMenuItem = {
  label: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
};

const DEFAULT_SEND_ACCENT = SEMANTIC_COLORS.green;
const DISABLED_ACCENT = "#7a7979";
const MAIN_SIZE = 28;
const SEND_SEGMENT_WIDTH = 34;
const MENU_SEGMENT_WIDTH = 20;

const SendButton: React.FC<{
  onClick: () => void;
  onCancel?: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Brand/method accent; harmonized with the active VS Code theme. */
  accent?: string;
  contextMenuItems?: SendButtonMenuItem[];
}> = ({ onClick, onCancel, disabled, loading, accent = DEFAULT_SEND_ACCENT, contextMenuItems }) => {
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  const [themeTick, setThemeTick] = useState(0);
  const hasMenu = Boolean(contextMenuItems?.length);
  const openMenu = Boolean(menuPos && hasMenu);

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
      }, 1500);
    } else {
      setShowCancel(false);
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
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

  const openContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    if (!contextMenuItems?.length) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    openMenuAt(event.clientX, event.clientY);
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLElement>) => {
    if (event.button !== 2 || !contextMenuItems?.length) {
      return;
    }
    openContextMenu(event);
  };

  useEffect(() => {
    const handleDocumentMouseDown = (event: MouseEvent) => {
      if (event.button !== 2 || !contextMenuItems?.length) {
        return;
      }
      const target = event.target;
      if (!target || !wrapperRef.current?.contains(target as Node)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      openMenuAt(event.clientX, event.clientY);
    };

    const handleDocumentContextMenu = (event: MouseEvent) => {
      const target = event.target;
      if (!target || !wrapperRef.current?.contains(target as Node)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener("mousedown", handleDocumentMouseDown, true);
    document.addEventListener("contextmenu", handleDocumentContextMenu, true);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown, true);
      document.removeEventListener("contextmenu", handleDocumentContextMenu, true);
    };
  }, [contextMenuItems, openMenuAt]);

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
      style={{
        position: "fixed",
        left: menuPos.left,
        top: menuPos.top,
        zIndex: 1000,
        background: "var(--vscode-editorWidget-background,#232323)",
        border: "1px solid var(--vscode-editorWidget-border,#333)",
        borderRadius: 4,
        boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
        minWidth: 180,
        padding: 2
      }}
      onClick={(event) => event.stopPropagation()}
    >
      {contextMenuItems?.map(item => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className="action-button"
          disabled={item.disabled}
          style={{ width: "100%", justifyContent: "flex-start" }}
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
      ))}
    </div>
  ) : null;

  const loadingRing = loading ? (
    <span
      style={{
        position: "absolute",
        inset: -4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 1
      }}
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        style={{
          animation: "spin 1s linear infinite"
        }}
      >
        <circle
          cx="16"
          cy="16"
          r="14"
          fill="none"
          stroke={activeChrome.onFill}
          strokeWidth="3"
          strokeDasharray="40"
          strokeDashoffset="10"
          strokeLinecap="round"
          opacity="0.7"
        />
        <style>
          {`@keyframes spin { 100% { transform: rotate(360deg); } }`}
        </style>
      </svg>
    </span>
  ) : null;

  const sendIcon = (
    <span
      className={`codicon ${showCancel ? "codicon-close" : "codicon-send"}`}
      style={{
        fontSize: "16px",
        zIndex: 2,
        color: activeChrome.onFill,
        marginLeft: showCancel ? "0" : "4px"
      }}
    />
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
          borderRadius: hasMenu ? MAIN_SIZE / 2 : "50%",
          overflow: "hidden",
          background: activeChrome.fill,
          border: `1px solid ${activeChrome.border}`,
          boxShadow: activeChrome.outline ? "none" : "0 2px 6px #0001",
          transition: "background-color 0.5s ease, border-color 0.5s ease",
        }}
        onMouseDown={handleMouseDown}
        onContextMenu={openContextMenu}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-haspopup={hasMenu ? "menu" : undefined}
        aria-expanded={openMenu || undefined}
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
            width: hasMenu ? SEND_SEGMENT_WIDTH : MAIN_SIZE,
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
          title={showCancel ? "Cancel" : "Send"}
          onClick={handleClick}
          disabled={disabled}
        >
          {loadingRing}
          {sendIcon}
        </button>
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
              title="More send options"
              aria-label="More send options"
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
      {menu && ReactDOM.createPortal(menu, document.body)}
    </>
  );
};

export default SendButton;
