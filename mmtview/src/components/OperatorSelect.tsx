import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckOps,
  getFuzzyPercentOperatorBase,
  getFuzzyPercentOperatorValue,
  getOpOptionLabel,
  getTimeOperatorBase,
  getTimeOperatorVelocity,
  isFuzzyPercentAnyOperator,
  isTimeAnyOperator,
  makeFuzzyPercentOperator,
  makeTimeOperator,
  normalizeTimeVelocity,
  selectableOpsList,
} from "mmt-core/TestData";
import { safeList } from "mmt-core/safer";
import StableTextInput from "./StableTextInput";

type OperatorSelectProps = {
  value: CheckOps;
  onChange: (value: CheckOps) => void;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  /** Narrow trigger for expect/require rows. */
  compact?: boolean;
};

/**
 * Operator picker: closed face shows the op only (`==`); open list shows
 * `op — name` via getOpOptionLabel.
 */
const OperatorSelect: React.FC<OperatorSelectProps> = ({
  value,
  onChange,
  className,
  style,
  title,
  compact = false,
}) => {
  const fuzzyBase = getFuzzyPercentOperatorBase(value);
  const timeBase = getTimeOperatorBase(value);
  const selectValue = (fuzzyBase || timeBase || value) as CheckOps;
  const fuzzyPercent = getFuzzyPercentOperatorValue(value);
  const timeVelocity = getTimeOperatorVelocity(value);
  const [velocityText, setVelocityText] = useState(timeVelocity);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    left: number;
    top: number;
    minWidth: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVelocityText(timeVelocity);
  }, [timeVelocity]);

  useLayoutEffect(() => {
    if (!menuOpen || !triggerRef.current) {
      setMenuPos(null);
      return;
    }
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      const minWidth = Math.max(compact ? 160 : 200, rect.width);
      const margin = 8;
      const left = Math.min(
        Math.max(margin, rect.left),
        window.innerWidth - minWidth - margin,
      );
      const top = Math.min(rect.bottom + 4, window.innerHeight - margin);
      setMenuPos({ left, top, minWidth });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [menuOpen, compact]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const updateOperator = (nextValue: CheckOps) => {
    if (nextValue === ">%" || nextValue === "<%") {
      onChange(makeFuzzyPercentOperator(nextValue, fuzzyPercent));
      return;
    }
    if (nextValue === "=s~" || nextValue === "!s~") {
      onChange(makeTimeOperator(nextValue, timeVelocity));
      return;
    }
    onChange(nextValue);
  };

  const updatePercent = (nextPercent: number) => {
    const base = fuzzyBase || ">%";
    onChange(makeFuzzyPercentOperator(base, nextPercent));
  };

  const updateVelocity = (nextVelocity: string) => {
    setVelocityText(nextVelocity);
    const normalized = normalizeTimeVelocity(nextVelocity);
    if (!normalized) {
      return;
    }
    onChange(makeTimeOperator(timeBase || "=s~", normalized));
  };

  const commitVelocity = () => {
    const normalized = normalizeTimeVelocity(velocityText);
    const next = normalized || timeVelocity;
    setVelocityText(next);
    onChange(makeTimeOperator(timeBase || "=s~", next));
  };

  const menuNode = menuOpen && menuPos ? (
    <div
      ref={menuRef}
      className="op-select-menu"
      role="listbox"
      style={{
        position: "fixed",
        left: menuPos.left,
        top: menuPos.top,
        minWidth: menuPos.minWidth,
        zIndex: 1000,
      }}
    >
      {safeList(selectableOpsList).map(relation => {
        const selected = relation === selectValue;
        return (
          <button
            key={relation}
            type="button"
            role="option"
            aria-selected={selected}
            className={["op-select-option", selected ? "is-selected" : ""]
              .filter(Boolean)
              .join(" ")}
            title={getOpOptionLabel(relation)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setMenuOpen(false);
              updateOperator(relation);
            }}
          >
            {getOpOptionLabel(relation)}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <div
      ref={rootRef}
      className={["op-select", compact ? "is-compact" : "", className]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      <button
        ref={triggerRef}
        type="button"
        className="op-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={menuOpen}
        aria-label={title || "Comparison operator"}
        title={title || getOpOptionLabel(selectValue)}
        onClick={() => setMenuOpen(current => !current)}
      >
        <span className="op-select-trigger-label">{selectValue}</span>
        <span className="codicon codicon-chevron-down" aria-hidden />
      </button>
      {menuNode ? createPortal(menuNode, document.body) : null}
      {isFuzzyPercentAnyOperator(value) && (
        <StableTextInput
          type="number"
          min={0}
          max={100}
          step={1}
          value={String(fuzzyPercent)}
          onChange={next => updatePercent(Number(next))}
          title="Fuzzy match percentage"
          className="op-select-percent"
        />
      )}
      {isTimeAnyOperator(value) && (
        <StableTextInput
          type="text"
          value={velocityText}
          onChange={next => updateVelocity(next)}
          onBlur={commitVelocity}
          title="Acceptable time difference (velocity)"
          placeholder="1s"
          className="op-select-velocity"
        />
      )}
    </div>
  );
};

export default OperatorSelect;
