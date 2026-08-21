import React, { useContext } from 'react';
import { FileContext } from '../fileContext';
import YamlErrorWarning from '../api/YamlErrorWarning';

export type HeaderActionProps = {
  icon: string;
  label: string;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
};

/** Ghost header launcher (Edit / Flow chart / Save as …). */
export function HeaderAction({
  icon,
  label,
  onClick,
  title,
  disabled,
}: HeaderActionProps) {
  const iconName = icon.startsWith('codicon-') ? icon : `codicon-${icon}`;
  return (
    <button
      className="action-button api-edit-launcher"
      onClick={onClick}
      title={title || label}
      type="button"
      disabled={disabled}
    >
      <span className={`codicon ${iconName}`} aria-hidden />
      <span className="api-edit-launcher-text">{label}</span>
    </button>
  );
}

export type PanelRunHeaderProps = {
  /** Shown in the inactive-looking title chip. Required unless `leading` is set. */
  title?: React.ReactNode;
  /** Codicon name without `codicon-` prefix (or with). */
  icon?: string;
  iconStyle?: React.CSSProperties;
  iconTitle?: string;
  /** Right-side actions (HeaderAction, warnings, etc.). */
  actions?: React.ReactNode;
  /**
   * Replace the default title chip (e.g. Doc view TabBar).
   * When set, `title` / `icon` are ignored.
   */
  leading?: React.ReactNode;
};

/**
 * Run / view page header: title chip (or custom leading) + optional actions.
 */
export default function PanelRunHeader({
  title,
  icon,
  iconStyle,
  iconTitle,
  actions,
  leading,
}: PanelRunHeaderProps) {
  const iconName = icon
    ? (icon.startsWith('codicon-') ? icon : `codicon-${icon}`)
    : null;
  const { yamlErrors } = useContext(FileContext);
  const hasYamlErrors = (yamlErrors?.length ?? 0) > 0;

  return (
    <div className="api-edit-header">
      <div className="tab-bar tab-bar-single panel-run-header">
        {leading != null ? (
          leading
        ) : (
          <div className="tab-button active panel-run-header-title" title={iconTitle}>
            {iconName && (
              <span className={`codicon ${iconName}`} aria-hidden style={iconStyle} />
            )}
            {title}
          </div>
        )}
        {(hasYamlErrors || actions != null) && (
          <div className="panel-run-header-actions">
            {hasYamlErrors && <YamlErrorWarning />}
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
