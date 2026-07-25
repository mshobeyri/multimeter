import React, { useEffect, useRef, useState } from 'react';

export type TabItem<T extends string = string> = {
  id: T;
  label: string;
  /** Codicon name without the `codicon-` prefix (e.g. `search`). */
  icon: string;
};

export type TabBarProps<T extends string = string> = {
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /**
   * When true (default), hide labels below `collapseWidth` and put the label
   * in the button `title` instead.
   */
  collapseLabels?: boolean;
  /** Width threshold for icon-only mode. Default: `tabs.length * 100`. */
  collapseWidth?: number;
  className?: string;
  style?: React.CSSProperties;
  /** `default` → `.tab-button`; `small` → `.tab-button-small`. */
  variant?: 'default' | 'small';
};

/**
 * Shared panel tab strip. Panels pass tab data; chrome and label-collapse live here.
 */
export default function TabBar<T extends string>({
  tabs,
  value,
  onChange,
  collapseLabels = true,
  collapseWidth,
  className,
  style,
  variant = 'default',
}: TabBarProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [iconsOnly, setIconsOnly] = useState(false);
  const widthThreshold = collapseWidth ?? tabs.length * 100;

  useEffect(() => {
    if (!collapseLabels) {
      setIconsOnly(false);
      return;
    }
    const el = ref.current;
    if (!el) {
      return;
    }
    const check = () => {
      setIconsOnly(el.clientWidth < widthThreshold);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [collapseLabels, widthThreshold, tabs.length]);

  const showIconsOnly = collapseLabels && iconsOnly;
  const btnClass = variant === 'small' ? 'tab-button-small' : 'tab-button';

  return (
    <div
      ref={ref}
      className={['tab-bar', className].filter(Boolean).join(' ')}
      style={style}
    >
      {tabs.map((tab) => {
        const active = value === tab.id;
        const iconName = tab.icon.startsWith('codicon-')
          ? tab.icon
          : `codicon-${tab.icon}`;
        return (
          <button
            key={tab.id}
            type="button"
            className={`${btnClass}${active ? ' active' : ''}`}
            onClick={() => onChange(tab.id)}
            title={showIconsOnly ? tab.label : undefined}
          >
            <span className={`codicon ${iconName} tab-button-icon`} aria-hidden />
            {!showIconsOnly && tab.label}
          </button>
        );
      })}
    </div>
  );
}
