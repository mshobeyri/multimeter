import React from 'react';
import { SuiteGroup } from './types';

interface SuiteEditProps {
  groups: SuiteGroup[];
  onAddMenuOpenChange: (open: boolean) => void;
  addButtonRef: React.RefObject<HTMLButtonElement | null>;
  addMenuOpen: boolean;
  addMenuPos: { left: number; top: number } | null;
  onOpenAddMenuAtButton: () => void;
  onAddGroup: () => void;
  onAddTestFile: () => void;
  renderTree: () => React.ReactNode;
  noItems: boolean;
}

const SuiteEdit: React.FC<SuiteEditProps> = ({
  addButtonRef,
  addMenuOpen,
  addMenuPos,
  onAddMenuOpenChange,
  onOpenAddMenuAtButton,
  onAddGroup,
  onAddTestFile,
  renderTree,
  noItems,
}) => {
  return (
    <div className="panel-box">
      <div className="test-flow-tree" style={{ paddingTop: 4 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 8,
            alignItems: 'center',
            position: 'relative',
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 700 }}>Suite</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              ref={addButtonRef as any}
              className="button-icon"
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => {
                event.stopPropagation();
                onAddMenuOpenChange(!addMenuOpen);
                if (!addMenuOpen) {
                  onOpenAddMenuAtButton();
                }
              }}
              title="Add suite item"
            >
              <span className="codicon codicon-add" aria-hidden />
              Add item
            </button>
          </div>
          {addMenuOpen && addMenuPos && (
            <div
              style={{
                position: 'fixed',
                left: addMenuPos.left,
                top: addMenuPos.top,
                zIndex: 1000,
                background: 'var(--vscode-editorWidget-background,#232323)',
                border: '1px solid var(--vscode-editorWidget-border,#333)',
                borderRadius: 4,
                boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                minWidth: 220,
                padding: 4,
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="action-button"
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onPointerUp={() => onAddGroup()}
                title="Insert a group separator (then)"
              >
                <span className="codicon codicon-list-tree" style={{ fontSize: 14, opacity: 0.85 }} aria-hidden />
                <span>Add group (then)</span>
              </button>
              <button
                className="action-button"
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onPointerUp={() => onAddTestFile()}
                title="Add a test file entry"
              >
                <span className="codicon codicon-symbol-file" style={{ fontSize: 14, opacity: 0.85 }} aria-hidden />
                <span>Add test file</span>
              </button>
            </div>
          )}
        </div>
        {noItems ? (
          <div style={{ opacity: 0.8 }}>No suite items found under `tests:`</div>
        ) : (
          renderTree()
        )}
      </div>
    </div>
  );
};

export default SuiteEdit;
