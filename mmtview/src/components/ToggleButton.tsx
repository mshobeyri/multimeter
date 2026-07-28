import React from 'react';

export type ToggleButtonProps = {
  active: boolean;
  onClick: () => void;
  title?: string;
  /** Codicon name without `codicon-` prefix. */
  icon?: string;
  /** Optional text label (makes the control expand beyond the icon chip). */
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
};

/**
 * Compact toggle used in toolbars / edit bars (auto-format, …).
 * Active state uses VS Code primary button tokens.
 */
export default function ToggleButton({
  active,
  onClick,
  title,
  icon,
  children,
  className,
  disabled,
}: ToggleButtonProps) {
  const iconName = icon
    ? (icon.startsWith('codicon-') ? icon : `codicon-${icon}`)
    : null;
  const hasText = children != null && children !== false && children !== '';
  return (
    <button
      type="button"
      className={[
        'toolbar-button',
        hasText ? 'toolbar-button--text' : '',
        active ? 'toolbar-button--toggle-active' : '',
        className,
      ].filter(Boolean).join(' ')}
      aria-pressed={active}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      {iconName && (
        <span className={`codicon ${iconName} toolbar-button-icon`} aria-hidden />
      )}
      {hasText ? <span className="toolbar-button-label">{children}</span> : null}
    </button>
  );
}
