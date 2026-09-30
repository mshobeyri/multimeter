import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import PopupMenu, { usePopupMenu, type PopupMenuItem } from "./PopupMenu";

export type OverflowTabItem<T extends string = string> = {
  id: T;
  label: string;
  /** Optional badge count shown after the label. */
  count?: number;
  /** When set, tab shows only this codicon (no text label). */
  iconOnly?: string;
  buttonClassName?: string;
  title?: string;
  "aria-label"?: string;
};

type OverflowTabBarProps<T extends string = string> = {
  tabs: readonly OverflowTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
  /** `default` → `.tab-button`; `small` → `.tab-button-small`. */
  variant?: "default" | "small";
  /**
   * When true (default), draw the full-width rule under the strip.
   * Active tab underline is unaffected.
   */
  showRule?: boolean;
  gap?: boolean;
};

function computeVisibleIndices(
  widths: number[],
  gap: number,
  available: number,
  moreWidth: number,
  activeIndex: number,
): number[] {
  const n = widths.length;
  if (n === 0) {
    return [];
  }
  let total = 0;
  for (let i = 0; i < n; i++) {
    total += widths[i] + (i > 0 ? gap : 0);
  }
  if (total <= available) {
    return widths.map((_, i) => i);
  }

  const budget = Math.max(0, available - moreWidth - gap);
  const active = activeIndex >= 0 && activeIndex < n ? activeIndex : 0;

  // Prefer left-aligned tabs when the active one still fits.
  const fromLeft: number[] = [];
  let used = 0;
  for (let i = 0; i < n; i++) {
    const next = used + (fromLeft.length ? gap : 0) + widths[i];
    if (next <= budget) {
      fromLeft.push(i);
      used = next;
      continue;
    }
    break;
  }
  if (fromLeft.includes(active)) {
    return fromLeft;
  }

  // Keep the active tab visible: grow left, then right.
  const result = [active];
  used = widths[active];
  for (let i = active - 1; i >= 0; i--) {
    const next = used + gap + widths[i];
    if (next > budget) {
      break;
    }
    result.unshift(i);
    used = next;
  }
  for (let i = active + 1; i < n; i++) {
    const next = used + gap + widths[i];
    if (next > budget) {
      break;
    }
    result.push(i);
    used = next;
  }
  return result;
}

/**
 * Tab strip that collapses overflow into a ≫ menu instead of wrapping.
 */
export default function OverflowTabBar<T extends string>({
  tabs,
  value,
  onChange,
  className,
  variant = "small",
  showRule = true,
  gap = true,
}: OverflowTabBarProps<T>) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [visibleIds, setVisibleIds] = useState<T[]>(() => tabs.map(t => t.id));
  const menu = usePopupMenu({ width: 180, offsetY: 4 });

  const btnClass = variant === "small" ? "tab-button-small" : "tab-button";
  const gapPx = gap ? 8 : 0;

  const recompute = useCallback(() => {
    const host = hostRef.current;
    const measure = measureRef.current;
    if (!host || !measure) {
      return;
    }
    const tabEls = Array.from(
      measure.querySelectorAll<HTMLElement>("[data-overflow-tab]"),
    );
    const moreEl = measure.querySelector<HTMLElement>("[data-overflow-more]");
    if (tabEls.length !== tabs.length) {
      return;
    }
    const widths = tabEls.map(el => el.getBoundingClientRect().width);
    const moreWidth = moreEl?.getBoundingClientRect().width ?? 28;
    const available = host.clientWidth;
    const activeIndex = Math.max(0, tabs.findIndex(t => t.id === value));
    const visible = computeVisibleIndices(widths, gapPx, available, moreWidth, activeIndex);
    const nextIds = visible.map(i => tabs[i].id);
    setVisibleIds(prev => {
      if (prev.length === nextIds.length && prev.every((id, i) => id === nextIds[i])) {
        return prev;
      }
      return nextIds;
    });
  }, [gapPx, tabs, value]);

  useLayoutEffect(() => {
    recompute();
    const host = hostRef.current;
    if (!host) {
      return;
    }
    const ro = new ResizeObserver(() => recompute());
    ro.observe(host);
    return () => ro.disconnect();
  }, [recompute]);

  const visibleSet = useMemo(() => new Set(visibleIds), [visibleIds]);
  const overflowTabs = useMemo(
    () => tabs.filter(tab => !visibleSet.has(tab.id)),
    [tabs, visibleSet],
  );
  const overflowActive = overflowTabs.some(tab => tab.id === value);

  const menuItems: PopupMenuItem[] = useMemo(
    () => overflowTabs.map(tab => ({
      label: tab.count && tab.count > 0 ? `${tab.label} (${tab.count})` : tab.label,
      icon: tab.iconOnly ? `codicon-${tab.iconOnly}` : undefined,
      onClick: () => onChange(tab.id),
      title: tab.title,
    })),
    [overflowTabs, onChange],
  );

  const renderTabButton = (tab: OverflowTabItem<T>, opts?: { measure?: boolean }) => {
    const active = value === tab.id;
    return (
      <button
        key={tab.id}
        type="button"
        data-overflow-tab={opts?.measure ? tab.id : undefined}
        className={[
          btnClass,
          tab.buttonClassName,
          active ? "active" : undefined,
        ].filter(Boolean).join(" ")}
        onClick={opts?.measure ? undefined : () => onChange(tab.id)}
        tabIndex={opts?.measure ? -1 : undefined}
        title={tab.title}
        aria-label={tab["aria-label"] ?? (tab.iconOnly ? tab.label : undefined)}
        aria-hidden={opts?.measure || undefined}
      >
        {tab.iconOnly ? (
          <span className={`codicon codicon-${tab.iconOnly} tab-button-icon`} aria-hidden />
        ) : (
          tab.label
        )}
        {tab.count != null && tab.count > 0 ? (
          <span className="apitest-tab-count">{tab.count}</span>
        ) : null}
      </button>
    );
  };

  return (
    <div ref={hostRef} className="overflow-tab-bar">
      <div
        ref={measureRef}
        className={[
          "overflow-tab-bar-measure",
          "tab-bar",
          gap ? "is-gap" : undefined,
          !showRule ? "is-no-rule" : undefined,
        ].filter(Boolean).join(" ")}
        aria-hidden
      >
        {tabs.map(tab => renderTabButton(tab, { measure: true }))}
        <button
          type="button"
          data-overflow-more
          className={`${btnClass} tab-overflow-more`}
          tabIndex={-1}
        >
          <span aria-hidden>≫</span>
        </button>
      </div>

      <div
        className={[
          "tab-bar",
          "is-overflow",
          gap ? "is-gap" : undefined,
          !showRule ? "is-no-rule" : undefined,
          className,
        ].filter(Boolean).join(" ")}
      >
        {tabs.filter(tab => visibleSet.has(tab.id)).map(tab => renderTabButton(tab))}
        {overflowTabs.length > 0 ? (
          <button
            ref={menu.triggerRef}
            type="button"
            className={`${btnClass} tab-overflow-more${overflowActive ? " active" : ""}`}
            title="More tabs"
            aria-label="More tabs"
            aria-haspopup="menu"
            aria-expanded={menu.open}
            onClick={() => menu.toggle()}
          >
            <span aria-hidden>≫</span>
          </button>
        ) : null}
      </div>

      {menu.open && menu.position ? (
        <PopupMenu
          position={menu.position}
          items={menuItems}
          menuRef={menu.menuRef}
          portal
          onClose={menu.close}
        />
      ) : null}
    </div>
  );
}
