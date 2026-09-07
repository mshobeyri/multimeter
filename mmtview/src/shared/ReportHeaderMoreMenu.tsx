import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

interface ReportHeaderMoreMenuProps {
  onExpandAll: () => void;
  onCollapseAll: () => void;
  disabled?: boolean;
}

/** Kebab menu for report/tree headers: Expand all / Collapse all. */
const ReportHeaderMoreMenu: React.FC<ReportHeaderMoreMenuProps> = ({
  onExpandAll,
  onCollapseAll,
  disabled,
}) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);

  const openAtButton = useCallback(() => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const menuWidth = 160;
    const margin = 8;
    const left = Math.min(
      Math.max(margin, rect.right - menuWidth),
      window.innerWidth - menuWidth - margin
    );
    const top = Math.min(rect.bottom + 4, window.innerHeight - margin);
    setMenuPos({ left, top });
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const close = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (menuRef.current?.contains(target) || btnRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
      setMenuPos(null);
    };
    const onScrollOrResize = () => {
      setOpen(false);
      setMenuPos(null);
    };
    document.addEventListener('mousedown', close, true);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize, true);
    return () => {
      document.removeEventListener('mousedown', close, true);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize, true);
    };
  }, [open]);

  const menu = open && menuPos ? (
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: 'fixed',
        left: menuPos.left,
        top: menuPos.top,
        zIndex: 1000,
        background: 'var(--vscode-editorWidget-background,#232323)',
        border: '1px solid var(--vscode-editorWidget-border,#333)',
        borderRadius: 4,
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        minWidth: 160,
        padding: 2,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        role="menuitem"
        className="action-button"
        style={{ width: '100%', justifyContent: 'flex-start' }}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => {
          e.stopPropagation();
          setOpen(false);
          setMenuPos(null);
          onExpandAll();
        }}
      >
        <span className="codicon codicon-expand-all" /> Expand all
      </button>
      <button
        type="button"
        role="menuitem"
        className="action-button"
        style={{ width: '100%', justifyContent: 'flex-start' }}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => {
          e.stopPropagation();
          setOpen(false);
          setMenuPos(null);
          onCollapseAll();
        }}
      >
        <span className="codicon codicon-collapse-all" /> Collapse all
      </button>
    </div>
  ) : null;

  return (
    <div className="report-header-more">
      <button
        ref={btnRef}
        type="button"
        className="action-button report-header-more-btn"
        disabled={disabled}
        title="More actions"
        aria-haspopup="menu"
        aria-expanded={open || undefined}
        aria-label="More actions"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => {
          e.stopPropagation();
          if (disabled) {
            return;
          }
          if (open) {
            setOpen(false);
            setMenuPos(null);
          } else {
            openAtButton();
          }
        }}
      >
        <span className={`codicon codicon-kebab-vertical report-header-more-icon${disabled ? ' is-disabled' : ''}`} />
      </button>
      {menu && ReactDOM.createPortal(menu, document.body)}
    </div>
  );
};

export default ReportHeaderMoreMenu;
