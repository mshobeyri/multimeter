import React, { useRef, useState } from 'react';
import 'react-complex-tree/lib/style.css';
import SuiteEdit from './SuiteEdit';
import SuiteTest from './SuiteTest';

interface SuitePanelProps {
  content: string;
  setContent: (value: string) => void;
}

const SuitePanel: React.FC<SuitePanelProps> = ({ content, setContent }) => {
  const [tab, setTab] = useState<'edit' | 'test'>('edit');
  const [showIconsOnly, setShowIconsOnly] = useState(false);
  const tabContainerRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const checkTabWidth = () => {
      if (!tabContainerRef.current) {
        return;
      }
      const containerWidth = tabContainerRef.current.clientWidth;
      const fullTextWidth = 2 * 100;
      setShowIconsOnly(containerWidth < fullTextWidth);
    };

    checkTabWidth();

    const resizeObserver = new ResizeObserver(checkTabWidth);
    if (tabContainerRef.current) {
      resizeObserver.observe(tabContainerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div className="panel">
      <div className="panel-box">
        <div ref={tabContainerRef} className="tab-bar">
          <button
            onClick={() => setTab('edit')}
            className={`tab-button ${tab === 'edit' ? 'active' : ''}`}
            title={showIconsOnly ? 'Edit' : undefined}
          >
            <span className="codicon codicon-edit tab-button-icon" />
            {!showIconsOnly && 'Edit'}
          </button>
          <button
            onClick={() => setTab('test')}
            className={`tab-button ${tab === 'test' ? 'active' : ''}`}
            title={showIconsOnly ? 'Test' : undefined}
          >
            <span className="codicon codicon-play tab-button-icon" />
            {!showIconsOnly && 'Test'}
          </button>
        </div>

        {tab === 'edit' && <SuiteEdit content={content} setContent={setContent} />}
        {tab === 'test' && <SuiteTest content={content} />}
      </div>
    </div>
  );
};

export default SuitePanel;
