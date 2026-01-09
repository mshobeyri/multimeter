import React from 'react';
import { TreeItem } from 'react-complex-tree';
import { StepStatus } from '../types';

export type SuiteTestFileItemData = { type: 'file'; path: string };

interface SuiteTestFileItemProps {
  item: TreeItem<any>;
  context: any;
  arrow: React.ReactNode;
  children: React.ReactNode;
  missingFiles: Set<string>;
  statusIconFor: (status: StepStatus | 'running') => { icon: string; color: string; title: string };
  status: StepStatus;
}

const SuiteTestFileItem: React.FC<SuiteTestFileItemProps> = ({
  item,
  context,
  arrow,
  children,
  missingFiles,
  statusIconFor,
  status,
}) => {
  const data = item.data as SuiteTestFileItemData;
  const isMissing = missingFiles.has(data.path);
  const statusIcon = isMissing
    ? {
        icon: 'codicon-warning',
        color: 'var(--vscode-editorWarning-foreground, #f8b449)',
        title: 'File not found',
      }
    : statusIconFor(status);

  return (
    <div {...context.itemContainerWithChildrenProps}>
      <div
        className="tree-view-box"
        {...context.itemContainerWithoutChildrenProps}
        style={{ paddingTop: 10, display: 'flex' }}
      >
        <div style={{ width: 24, minWidth: 24, display: 'inline-flex', alignItems: 'flex-start' }}>{arrow}</div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span
            className={`codicon ${statusIcon.icon}`}
            aria-hidden
            title={statusIcon.title}
            style={{ color: statusIcon.color }}
          />
          <div
            style={{
              fontFamily: 'var(--vscode-editor-font-family)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              width: '100%',
            }}
            title={data.path}
          >
            {data.path}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
};

export default SuiteTestFileItem;
