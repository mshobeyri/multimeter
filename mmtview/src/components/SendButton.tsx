import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";

export type SendButtonMenuItem = {
  label: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
};

const SendButton: React.FC<{
  onClick: () => void;
  onCancel?: () => void;
  disabled?: boolean;
  loading?: boolean;
  contextMenuItems?: SendButtonMenuItem[];
}> = ({ onClick, onCancel, disabled, loading, contextMenuItems }) => {
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  const openMenu = Boolean(menuPos && contextMenuItems?.length);

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
      if (timer) clearTimeout(timer);
    };
  }, [loading]);

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

  return (
    <>
      <span
        ref={wrapperRef}
        style={{ display: "inline-flex" }}
        onMouseDown={handleMouseDown}
        onContextMenu={openContextMenu}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-haspopup={contextMenuItems?.length ? "menu" : undefined}
        aria-expanded={openMenu || undefined}
      >
        <button
          ref={btnRef}
          style={{
            background: disabled
              ? "#7a7979"
              : showCancel
                ? (hover ? "#c62828" : "#d32f2f")
                : (hover ? "#2e7d32" : "#43a047"),
            color: "#fff",
            border: "none",
            borderRadius: "50%",
            width: 30,
            height: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: disabled ? "not-allowed" : "pointer",
            boxShadow: "0 2px 6px #0001",
            padding: 0,
            outline: "none",
            transition: "background-color 0.5s ease"
          }}
          title={showCancel ? "Cancel" : "Send"}
          onClick={handleClick}
          disabled={disabled}
        >
          {loading && (
            <span
              style={{
                position: "absolute",
                width: 38,
                height: 38,
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
                  stroke="#fff"
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
          )}
          <span
            className={`codicon ${showCancel ? "codicon-close" : "codicon-send"}`}
            style={{
              fontSize: "16px",
              zIndex: 2,
              color: "#fff",
              marginLeft: showCancel ? "0" : "4px"
            }}
          ></span>
        </button>
      </span>
      {menu && ReactDOM.createPortal(menu, document.body)}
    </>
  );
};

export default SendButton;