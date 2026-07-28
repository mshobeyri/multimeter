import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { FlowType, addableFlowTypes } from 'mmt-core/TestData';
import { codiconForStepType } from './stepPresentation';

export type TestFlowFlowProps = {
  arrow?: React.ReactNode;
  multiStage: boolean;
  onToggleMultiStage: (enabled: boolean) => void;
  onAddItem: (type: FlowType) => void;
  itemContainerWithoutChildrenProps?: React.HTMLAttributes<HTMLElement>;
};

/**
 * Root flow row chrome: multistage toggle + add-item menu (no drag/kebab).
 * Add menu is portaled so `.tree-view-box` overflow cannot clip it.
 */
const TestFlowFlow: React.FC<TestFlowFlowProps> = ({
  arrow,
  multiStage,
  onToggleMultiStage,
  onAddItem,
  itemContainerWithoutChildrenProps,
}) => {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  const addBtnRef = useRef<HTMLButtonElement | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);

  const openMenuAtButton = () => {
    const el = addBtnRef.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const menuWidth = 200;
    const margin = 8;
    const left = Math.min(
      Math.max(margin, rect.right - menuWidth),
      window.innerWidth - menuWidth - margin,
    );
    const top = Math.min(rect.bottom + 4, window.innerHeight - margin);
    setMenuPos({ left, top });
  };

  useEffect(() => {
    if (!addMenuOpen) {
      return;
    }

    const onDocDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (addBtnRef.current?.contains(target)) {
        return;
      }
      if (addMenuRef.current?.contains(target)) {
        return;
      }
      setAddMenuOpen(false);
      setMenuPos(null);
    };
    const closeMenu = () => {
      setAddMenuOpen(false);
      setMenuPos(null);
    };
    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && addMenuRef.current?.contains(target)) {
        return;
      }
      closeMenu();
    };

    document.addEventListener('mousedown', onDocDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', closeMenu);
    return () => {
      document.removeEventListener('mousedown', onDocDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', closeMenu);
    };
  }, [addMenuOpen]);

  const stopTree = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  const {
    className: containerClassName,
    ...containerRest
  } = (itemContainerWithoutChildrenProps || {}) as React.HTMLAttributes<HTMLDivElement>;

  const menu = addMenuOpen && menuPos ? (
    <div
      ref={addMenuRef}
      className="test-flow-add-menu"
      role="menu"
      style={{ left: menuPos.left, top: menuPos.top }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {addableFlowTypes.map((type) => {
        const stageDisabled = type === 'stage' && !multiStage;
        return (
          <button
            key={type}
            className="action-button"
            type="button"
            role="menuitem"
            style={{
              width: '100%',
              justifyContent: 'flex-start',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              opacity: stageDisabled ? 0.5 : 1,
            }}
            onPointerUp={() => {
              if (stageDisabled) {
                return;
              }
              setAddMenuOpen(false);
              setMenuPos(null);
              onAddItem(type);
            }}
            disabled={stageDisabled}
            title={stageDisabled ? 'Enable Multistage to add a stage' : `Add ${type}`}
          >
            <span
              className={`codicon codicon-${codiconForStepType(type)}`}
              style={{ fontSize: 14, opacity: 0.85 }}
              aria-hidden
            />
            <span>{type}</span>
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <div
      className={['tree-view-box', 'test-flow-root-row', containerClassName].filter(Boolean).join(' ')}
      {...containerRest}
    >
      {arrow}
      <div className="test-flow-box-items">
        <span className="test-flow-root-title">flow</span>
        <div
          className="test-flow-root-actions"
          onMouseDownCapture={stopTree}
          onFocusCapture={stopTree}
          onKeyDown={stopTree}
          onKeyUp={stopTree}
        >
          <button
            className={`action-button test-flow-root-toggle${multiStage ? ' is-pressed' : ''}`}
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => {
              e.stopPropagation();
              onToggleMultiStage(!multiStage);
            }}
            title={multiStage ? 'Multistage on' : 'Multistage off'}
            aria-label="Multistage"
            aria-pressed={multiStage}
          >
            <span className="codicon codicon-collection" aria-hidden />
          </button>
          <button
            ref={addBtnRef}
            className="action-button test-flow-root-add"
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => {
              e.stopPropagation();
              if (addMenuOpen) {
                setAddMenuOpen(false);
                setMenuPos(null);
                return;
              }
              openMenuAtButton();
              setAddMenuOpen(true);
            }}
            title="Add flow item"
            aria-label="Add flow item"
            aria-haspopup="menu"
            aria-expanded={addMenuOpen}
          >
            <span className="codicon codicon-add" aria-hidden />
          </button>
        </div>
      </div>
      {menu && ReactDOM.createPortal(menu, document.body)}
    </div>
  );
};

export default TestFlowFlow;
