import React, { useEffect, useRef, useState } from "react";

type FadePaneProps = {
  /** When this changes, current content fades out, then the new content fades in. */
  paneKey: string;
  className?: string;
  children: React.ReactNode;
  /** Fade-out duration (ms); fade-in uses the same timing. */
  durationMs?: number;
};

/**
 * Light hide-then-show swap for tab panels and section edit/view bodies.
 * Tab panels sized by the parent flex area — content swaps do not resize height.
 */
const FadePane: React.FC<FadePaneProps> = ({
  paneKey,
  className,
  children,
  durationMs = 120,
}) => {
  const childrenRef = useRef(children);
  childrenRef.current = children;

  const [renderedKey, setRenderedKey] = useState(paneKey);
  const [rendered, setRendered] = useState(children);
  const [visible, setVisible] = useState(true);

  // Keep same-key content live without restarting a fade.
  useEffect(() => {
    if (paneKey !== renderedKey || !visible) {
      return;
    }
    setRendered(children);
  }, [children, paneKey, renderedKey, visible]);

  // Fade out → swap → fade in only when the pane key changes.
  useEffect(() => {
    if (paneKey === renderedKey) {
      return;
    }
    setVisible(false);
    const t = window.setTimeout(() => {
      setRenderedKey(paneKey);
      setRendered(childrenRef.current);
      setVisible(true);
    }, durationMs);
    return () => window.clearTimeout(t);
  }, [paneKey, renderedKey, durationMs]);

  return (
    <div
      className={[
        "apitest-fade-pane",
        visible ? "is-in" : "is-out",
        className,
      ].filter(Boolean).join(" ")}
      style={{ ["--apitest-fade-ms" as string]: `${durationMs}ms` }}
    >
      {rendered}
    </div>
  );
};

export default FadePane;
