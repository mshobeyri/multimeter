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

  useEffect(() => {
    if (paneKey === renderedKey) {
      setRendered(children);
      return;
    }
    setVisible(false);
    const t = window.setTimeout(() => {
      setRenderedKey(paneKey);
      setRendered(childrenRef.current);
      setVisible(true);
    }, durationMs);
    return () => window.clearTimeout(t);
  }, [paneKey, renderedKey, durationMs, children]);

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
