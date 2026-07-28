import { useEffect, useMemo, useState } from 'react';

import {
  AccentChrome,
  HarmonizeAccentOptions,
  accentChromeFor,
} from './themeAccent';

/** Theme-aware accent chrome that recomputes on VS Code color-theme changes. */
export function useAccentChrome(
    key: string,
    options?: HarmonizeAccentOptions,
): AccentChrome {
  const [themeTick, setThemeTick] = useState(0);
  const fillAmount = options?.fillAmount;
  const softAmount = options?.softAmount;
  const textAmount = options?.textAmount;
  const outline = options?.outline;

  useEffect(() => {
    const onTheme = () => setThemeTick((n) => n + 1);
    window.addEventListener('vscode:changeColorTheme', onTheme as EventListener);
    return () => window.removeEventListener('vscode:changeColorTheme', onTheme as EventListener);
  }, []);

  return useMemo(
      () => accentChromeFor(key, {
        fillAmount,
        softAmount,
        textAmount,
        outline,
        surfaces: options?.surfaces,
      }),
      // themeTick forces recompute when VS Code theme CSS vars change
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [key, fillAmount, softAmount, textAmount, outline, themeTick],
  );
}
