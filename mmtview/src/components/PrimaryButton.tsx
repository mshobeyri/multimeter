import React, { forwardRef } from 'react';

export type PrimaryButtonProps = {
  children?: React.ReactNode;
  /** Codicon name without `codicon-` prefix. */
  icon?: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  title?: string;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Shared primary CTA (VS Code button tokens). Use instead of hand-rolled
 * `button.button-icon` markup or inline button chrome.
 */
const PrimaryButton = forwardRef<HTMLButtonElement, PrimaryButtonProps>(
  function PrimaryButton(
    {
      children,
      icon,
      onClick,
      onPointerDown,
      onPointerUp,
      disabled,
      title,
      type = 'button',
      className,
      style,
    },
    ref,
  ) {
    const iconName = icon
      ? (icon.startsWith('codicon-') ? icon : `codicon-${icon}`)
      : null;
    return (
      <button
        ref={ref}
        type={type}
        className={['primary-button', className].filter(Boolean).join(' ')}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        disabled={disabled}
        title={title}
        style={style}
      >
        {iconName && <span className={`codicon ${iconName}`} aria-hidden />}
        {children}
      </button>
    );
  },
);

export default PrimaryButton;

/**
 * Non-interactive face that matches PrimaryButton look (e.g. under an
 * invisible `<select>` overlay for format pickers).
 */
export function PrimaryButtonFace({
  children,
  icon,
  disabled,
  className,
  style,
}: Omit<PrimaryButtonProps, 'onClick' | 'type' | 'title' | 'onPointerDown' | 'onPointerUp'>) {
  const iconName = icon
    ? (icon.startsWith('codicon-') ? icon : `codicon-${icon}`)
    : null;
  return (
    <div
      className={[
        'primary-button',
        disabled ? 'is-disabled' : '',
        className,
      ].filter(Boolean).join(' ')}
      style={{ pointerEvents: 'none', ...style }}
      aria-hidden
    >
      {iconName && <span className={`codicon ${iconName}`} aria-hidden />}
      {children}
    </div>
  );
}
