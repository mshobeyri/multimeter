import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

export type PopupMenuItem = {
  label: string;
  icon?: string;
  iconClass?: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
};

export type PopupMenuPosition = { left: number; top: number };

type PopupMenuProps = {
  position: PopupMenuPosition;
  items: PopupMenuItem[];
  onClose?: () => void;
  className?: string;
  itemClassName?: string;
  portal?: boolean;
  menuRef?: React.Ref<HTMLDivElement>;
  stopWheel?: boolean;
};

const PopupMenu: React.FC<PopupMenuProps> = ({
  position,
  items,
  onClose,
  className = "popup-menu",
  itemClassName,
  portal = false,
  menuRef,
  stopWheel,
}) => {
  const menu = (
    <div
      ref={menuRef}
      className={className}
      role="menu"
      style={{ left: position.left, top: position.top }}
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      onWheel={stopWheel ? e => e.stopPropagation() : undefined}
    >
      {items.map(item => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={["action-button", itemClassName].filter(Boolean).join(" ")}
          disabled={item.disabled}
          title={item.title}
          onPointerDown={e => e.stopPropagation()}
          onPointerUp={e => {
            e.stopPropagation();
            if (item.disabled) {
              return;
            }
            onClose?.();
            item.onClick();
          }}
          onKeyDown={e => {
            if ((e.key === "Enter" || e.key === " ") && !item.disabled) {
              e.preventDefault();
              onClose?.();
              item.onClick();
            }
          }}
        >
          {item.icon && (
            <span
              className={["codicon", item.icon, item.iconClass].filter(Boolean).join(" ")}
              aria-hidden
            />
          )}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );

  if (portal && typeof document !== "undefined") {
    return ReactDOM.createPortal(menu, document.body);
  }
  return menu;
};

type UsePopupMenuOptions = {
  width?: number;
  offsetY?: number;
};

export function usePopupMenu(options?: UsePopupMenuOptions) {
  const width = options?.width ?? 160;
  const offsetY = options?.offsetY ?? 4;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopupMenuPosition | null>(null);

  const placeAtTrigger = useCallback(() => {
    const el = triggerRef.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const maxLeft = typeof window !== "undefined"
      ? window.innerWidth - width - margin
      : margin;
    const left = Math.max(margin, Math.min(maxLeft, rect.right - width));
    const top = typeof window !== "undefined"
      ? Math.min(rect.bottom + offsetY, window.innerHeight - margin)
      : rect.bottom + offsetY;
    setPosition({ left, top });
  }, [offsetY, width]);

  const close = useCallback(() => {
    setOpen(false);
    setPosition(null);
  }, []);

  const toggle = useCallback(() => {
    setOpen(prev => {
      if (prev) {
        setPosition(null);
        return false;
      }
      placeAtTrigger();
      return true;
    });
  }, [placeAtTrigger]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (triggerRef.current?.contains(target)) {
        return;
      }
      if (menuRef.current?.contains(target)) {
        return;
      }
      close();
    };
    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) {
        return;
      }
      close();
    };
    document.addEventListener("mousedown", onDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [close, open]);

  return { open, position, triggerRef, menuRef, toggle, close, placeAtTrigger };
}

type KebabMenuProps = {
  items: PopupMenuItem[];
  className?: string;
  menuClassName?: string;
  itemClassName?: string;
};

export const KebabMenu: React.FC<KebabMenuProps> = ({
  items,
  className,
  menuClassName = "popup-menu",
  itemClassName,
}) => {
  const menu = usePopupMenu({ width: 160 });
  const trigger = (
    <button
      ref={menu.triggerRef}
      className="action-button"
      type="button"
      onPointerDown={e => e.stopPropagation()}
      onPointerUp={e => {
        e.stopPropagation();
        menu.toggle();
      }}
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          menu.toggle();
        }
      }}
      draggable={false}
      tabIndex={0}
      aria-haspopup="menu"
      aria-expanded={menu.open}
      title="More actions"
    >
      <span className="codicon codicon-kebab-vertical" />
    </button>
  );
  const popup = menu.open && menu.position ? (
    <PopupMenu
      position={menu.position}
      items={items}
      menuRef={menu.menuRef}
      portal
      onClose={menu.close}
      className={menuClassName}
      itemClassName={itemClassName}
    />
  ) : null;
  if (className) {
    return (
      <div className={className}>
        {trigger}
        {popup}
      </div>
    );
  }
  return (
    <>
      {trigger}
      {popup}
    </>
  );
};

export default PopupMenu;
