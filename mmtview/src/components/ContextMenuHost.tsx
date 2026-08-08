import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

export type ContextMenuItem = {
  label: string;
  icon?: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
};

/** Wraps children and shows a portal context menu on right-click. */
const ContextMenuHost: React.FC<{
  items?: ContextMenuItem[];
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}> = ({ items, children, style, className }) => {
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  const openMenu = Boolean(menuPos && items?.length);

  const openMenuAt = useCallback((clientX: number, clientY: number) => {
    if (!items?.length) {
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
  }, [items?.length]);

  const openContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    if (!items?.length) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    openMenuAt(event.clientX, event.clientY);
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLElement>) => {
    if (event.button !== 2 || !items?.length) {
      return;
    }
    openContextMenu(event);
  };

  useEffect(() => {
    const handleDocumentMouseDown = (event: MouseEvent) => {
      if (event.button !== 2 || !items?.length) {
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
  }, [items, openMenuAt]);

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
      {items?.map(item => (
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
        className={className}
        style={{ display: "inline-flex", ...style }}
        onMouseDown={handleMouseDown}
        onContextMenu={openContextMenu}
        aria-haspopup={items?.length ? "menu" : undefined}
        aria-expanded={openMenu || undefined}
      >
        {children}
      </span>
      {menu ? ReactDOM.createPortal(menu, document.body) : null}
    </>
  );
};

/** Menu item: open Multimeter output channel, then run. */
export function runInCoreMenuItem(
  onRun: () => void | Promise<void>,
  options?: { disabled?: boolean; label?: string },
): ContextMenuItem {
  return {
    label: options?.label ?? "Run in Core",
    icon: "codicon-play",
    disabled: options?.disabled,
    onClick: () => {
      window.vscode?.postMessage({ command: "showLogOutputChannel" });
      void onRun();
    },
  };
}

export default ContextMenuHost;
