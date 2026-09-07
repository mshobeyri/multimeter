import React, {useEffect, useRef, useState} from 'react';
import {JudgeModelInfo} from './judgeProbeHelpers';

type UrlFieldProps = {
  value: string;
  defaultUrl: string;
  isDefault: boolean;
  onChange: (value: string) => void;
  onApplyDefault: () => void;
  placeholder?: string;
};

/** URL input with an inline Default control on the right. */
export const JudgeUrlField: React.FC<UrlFieldProps> = ({
  value,
  defaultUrl,
  isDefault,
  onChange,
  onApplyDefault,
  placeholder,
}) => {
  return (
    <div className="judge-affix-field">
      <input
        className="judge-affix-field__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || defaultUrl || 'https://…'}
        spellCheck={false}
      />
      <button
        type="button"
        className={`judge-affix-field__chip${isDefault ? ' judge-affix-field__chip--active' : ''}`}
        onClick={onApplyDefault}
        disabled={!defaultUrl || isDefault}
        title={isDefault
            ? 'Using the engine default URL'
            : `Use default URL (${defaultUrl})`}
      >
        Default
      </button>
    </div>
  );
};

type ModelComboProps = {
  value: string;
  models: JudgeModelInfo[];
  probeState: 'idle'|'loading'|'ok'|'error';
  probeMessage?: string;
  onChange: (value: string) => void;
  onRefresh: () => void;
  placeholder?: string;
};

/** Editable model field; chevron opens available models as a table. */
export const JudgeModelCombo: React.FC<ModelComboProps> = ({
  value,
  models,
  probeState,
  probeMessage,
  onChange,
  onRefresh,
  placeholder,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      onRefresh();
    }
  };

  return (
    <div ref={rootRef} className="judge-affix-field judge-model-combo">
      <input
        className="judge-affix-field__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Select or type a model'}
        spellCheck={false}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
            onRefresh();
          }
          if (e.key === 'Escape' && open) {
            setOpen(false);
          }
        }}
      />
      <button
        type="button"
        className="field-button judge-model-combo__toggle"
        onClick={toggleOpen}
        title="Show available models"
        aria-expanded={open}
      >
        <span
          className={`codicon ${open ? 'codicon-chevron-up' : 'codicon-chevron-down'}`}
          style={{fontSize: 16}}
        />
      </button>

      {open && (
        <div className="judge-model-combo__menu" role="listbox">
          <div className="judge-model-combo__menu-head">
            <span>
              {probeState === 'loading'
                  ? 'Loading models…'
                  : probeState === 'error'
                      ? (probeMessage || 'Unable to list models')
                      : models.length
                          ? `${models.length} available`
                          : 'No models reported'}
            </span>
            <button
              type="button"
              className="field-button"
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}
              disabled={probeState === 'loading'}
              title="Refresh models"
            >
              <span
                className={`codicon codicon-refresh${probeState === 'loading' ? ' codicon-modifier-spin' : ''}`}
                style={{fontSize: 14}}
              />
            </button>
          </div>

          {models.length > 0 ? (
            <div className="judge-model-combo__menu-list">
              <table className="judge-model-combo__table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Details</th>
                    <th>Size</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((model) => {
                    const selected = model.name === value;
                    return (
                      <tr
                        key={model.name}
                        role="option"
                        aria-selected={selected}
                        className={selected ? 'judge-model-combo__tr--selected' : undefined}
                        onClick={() => {
                          onChange(model.name);
                          setOpen(false);
                        }}
                      >
                        <td className="judge-model-combo__td-model">{model.name}</td>
                        <td>{model.detail || '—'}</td>
                        <td>{model.sizeLabel || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="judge-model-combo__menu-empty">
              {probeState === 'idle'
                  ? 'Open to load models from the engine URL.'
                  : probeState === 'loading'
                      ? 'Checking connection…'
                      : probeState === 'error'
                          ? (probeMessage || 'Connection failed')
                          : 'Type a model name, or fix the URL / auth and refresh.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
