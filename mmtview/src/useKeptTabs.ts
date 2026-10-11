import { useCallback, useEffect, useRef, useState } from 'react';

const WARM_INACTIVE_DELAY_MS = 120;

type KeptTabsState<T extends string> = {
  resetKey: string;
  tabs: ReadonlySet<T>;
};

/**
 * Mount the active tab first, then warm the rest in the background and keep
 * them mounted until `resetKey` changes (e.g. file path).
 */
export function useKeptTabs<T extends string>(
  active: T,
  allTabs: readonly T[],
  resetKey = '',
): (tab: T) => boolean {
  const allTabsRef = useRef(allTabs);
  allTabsRef.current = allTabs;

  const [kept, setKept] = useState<KeptTabsState<T>>(() => ({
    resetKey,
    tabs: allTabs.includes(active) ? new Set<T>([active]) : new Set<T>(),
  }));

  if (kept.resetKey !== resetKey) {
    setKept({
      resetKey,
      tabs: allTabsRef.current.includes(active) ? new Set<T>([active]) : new Set<T>(),
    });
  }

  useEffect(() => {
    if (!allTabsRef.current.includes(active)) {
      return;
    }
    setKept(prev => {
      if (prev.resetKey !== resetKey || prev.tabs.has(active)) {
        return prev;
      }
      const tabs = new Set(prev.tabs);
      tabs.add(active);
      return { resetKey, tabs };
    });
  }, [active, resetKey]);

  useEffect(() => {
    const tabsToWarm = allTabsRef.current;
    if (!tabsToWarm.length) {
      return;
    }

    let cancelled = false;
    const warm = () => {
      if (cancelled) {
        return;
      }
      setKept(prev => {
        if (prev.resetKey !== resetKey) {
          return prev;
        }
        let changed = false;
        const tabs = new Set(prev.tabs);
        for (const tab of tabsToWarm) {
          if (!tabs.has(tab)) {
            tabs.add(tab);
            changed = true;
          }
        }
        return changed ? { resetKey, tabs } : prev;
      });
    };

    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof win.requestIdleCallback === 'function') {
      const idleId = win.requestIdleCallback(warm, { timeout: 500 });
      return () => {
        cancelled = true;
        win.cancelIdleCallback?.(idleId);
      };
    }

    const timer = window.setTimeout(warm, WARM_INACTIVE_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [resetKey, allTabs]);

  return useCallback((tab: T) => {
    if (!allTabsRef.current.includes(tab)) {
      return false;
    }
    if (tab === active) {
      return true;
    }
    return kept.resetKey === resetKey && kept.tabs.has(tab);
  }, [active, kept, resetKey]);
}
