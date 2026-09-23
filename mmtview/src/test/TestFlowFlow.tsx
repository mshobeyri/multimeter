import React from 'react';
import { FlowType, addableFlowTypes } from 'mmt-core/TestData';
import { codiconForStepType } from './stepPresentation';
import PopupMenu, { usePopupMenu } from '../components/PopupMenu';

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
  const {
    open: addMenuOpen,
    position: menuPos,
    triggerRef: addBtnRef,
    menuRef: addMenuRef,
    toggle: toggleAddMenu,
    close: closeAddMenu,
  } = usePopupMenu({ width: 200 });

  const stopTree = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  const {
    className: containerClassName,
    ...containerRest
  } = (itemContainerWithoutChildrenProps || {}) as React.HTMLAttributes<HTMLDivElement>;

  const menu = addMenuOpen && menuPos ? (
    <PopupMenu
      position={menuPos}
      menuRef={addMenuRef}
      className="test-flow-add-menu"
      portal
      stopWheel
      onClose={closeAddMenu}
      items={addableFlowTypes.map((type) => {
        const stageDisabled = type === 'stage' && !multiStage;
        return {
          label: type,
          icon: `codicon-${codiconForStepType(type)}`,
          iconClass: "test-flow-menu-icon",
          disabled: stageDisabled,
          title: stageDisabled ? "Enable Multistage to add a stage" : `Add ${type}`,
          onClick: () => onAddItem(type),
        };
      })}
    />
  ) : null;

  return (
    <div
      className={['tree-view-box', 'test-flow-root-row', containerClassName].filter(Boolean).join(' ')}
      {...containerRest}
    >
      {arrow}
      <div className="test-flow-box-items">
        <span className="test-flow-root-title">{multiStage ? 'stages' : 'steps'}</span>
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
              toggleAddMenu();
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
      {menu}
    </div>
  );
};

export default TestFlowFlow;
