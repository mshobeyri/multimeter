import React, { forwardRef, useEffect, useMemo, useState } from 'react';

import {
  colorsNearlyEqual,
  readThemeSurfaces,
} from '../shared/themeAccent';
import { useAccentChrome } from '../shared/useAccentChrome';

export type PrimaryButtonProps = {
  children?: React.ReactNode;
  /** Codicon name without `codicon-` prefix. */
  icon?: string;
  /** Apply `codicon-modifier-spin` to the icon (loading/sync). */
  iconSpin?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  title?: string;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  style?: React.CSSProperties;
  /**
   * Optional semantic accent (`green` / `red` / method key). When set, uses
   * theme-harmonized fill instead of plain VS Code button tokens.
   */
  accent?: string;
};

function useThemeTick(): number {
  const [themeTick, setThemeTick] = useState(0);
  useEffect(() => {
    const onTheme = () => setThemeTick((n) => n + 1);
    window.addEventListener('vscode:changeColorTheme', onTheme as EventListener);
    return () => window.removeEventListener('vscode:changeColorTheme', onTheme as EventListener);
  }, []);
  return themeTick;
}

/** Resolve a button border: theme border when distinct, else transparent (match fill). */
function usePrimaryButtonBorder(accentBorder?: string | null): string {
  const themeTick = useThemeTick();
  return useMemo(() => {
    if (accentBorder) {
      return accentBorder;
    }
    const surfaces = readThemeSurfaces();
    const themeBorder = surfaces.buttonBorder;
    if (themeBorder && !colorsNearlyEqual(themeBorder, surfaces.buttonBackground)) {
      return themeBorder;
    }
    return 'transparent';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accentBorder, themeTick]);
}

/**
 * Shared primary CTA (VS Code button tokens). Use instead of hand-rolled
 * `button.button-icon` markup or inline button chrome.
 */
const PrimaryButton = forwardRef<HTMLButtonElement, PrimaryButtonProps>(
  function PrimaryButton(
    {
      children,
      icon,
      iconSpin,
      onClick,
      onPointerDown,
      onPointerUp,
      disabled,
      title,
      type = 'button',
      className,
      style,
      accent,
    },
    ref,
  ) {
    const iconName = icon
      ? (icon.startsWith('codicon-') ? icon : `codicon-${icon}`)
      : null;
    // Always call hook (rules of hooks); unused when accent is unset.
    const accentChrome = useAccentChrome(accent || 'blue');
    const borderColor = usePrimaryButtonBorder(
      accent ? accentChrome.border : null,
    );
    const accentStyle: React.CSSProperties = accent
      ? {
          background: accentChrome.fill,
          color: accentChrome.onFill,
          ['--mmt-button-border' as string]: borderColor,
        }
      : {
          ['--mmt-button-border' as string]: borderColor,
        };

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
        style={{ ...accentStyle, ...style }}
      >
        {iconName && (
          <span
            className={['codicon', iconName, iconSpin ? 'codicon-modifier-spin' : '']
              .filter(Boolean)
              .join(' ')}
            aria-hidden
          />
        )}
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
}: Omit<PrimaryButtonProps, 'onClick' | 'type' | 'title' | 'onPointerDown' | 'onPointerUp' | 'accent'>) {
  const iconName = icon
    ? (icon.startsWith('codicon-') ? icon : `codicon-${icon}`)
    : null;
  const borderColor = usePrimaryButtonBorder(null);
  return (
    <div
      className={[
        'primary-button',
        disabled ? 'is-disabled' : '',
        className,
      ].filter(Boolean).join(' ')}
      style={{
        pointerEvents: 'none',
        ['--mmt-button-border' as string]: borderColor,
        ...style,
      }}
      aria-hidden
    >
      {iconName && <span className={`codicon ${iconName}`} aria-hidden />}
      {children}
    </div>
  );
}
