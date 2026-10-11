import { createRoot } from "react-dom/client";
import "./vendor/codicons/codicon.css";
import App from "./App";

function eventTargetElement(event: Event): Element | null {
  const path = typeof event.composedPath === "function" ? event.composedPath() : [];
  for (const node of path) {
    if (node instanceof Element) {
      return node;
    }
  }
  const raw = event.target;
  if (raw instanceof Element) {
    return raw;
  }
  if (raw instanceof Node) {
    return raw.parentElement;
  }
  return null;
}

/** Surfaces where copy/select is intentional (YAML editor is outside .mmt-ui-panel). */
const SELECTABLE_UI =
  "pre, textarea, input, [contenteditable=\"true\"], .monaco-editor, .monaco-diff-editor, .highlighted-body, .highlighted-body-pre, .report-selectable, .report-headers-content, .report-headers-table, .doc-preview, .doc-preview-body, .environment-table-name";

document.addEventListener("selectstart", event => {
  const target = eventTargetElement(event);
  if (!target) {
    return;
  }
  // Left YAML pane and portals outside the right panel stay freely selectable.
  if (!target.closest(".mmt-ui-panel")) {
    return;
  }
  if (target.closest(SELECTABLE_UI)) {
    return;
  }
  event.preventDefault();
}, true);

document.addEventListener("contextmenu", event => {
  // Monaco view-lines often deliver Text nodes as the event target. Walk
  // composedPath / parent Element before closest() — otherwise preventDefault
  // blocks Monaco's menu (common after Save to YAML clears the selection).
  const target = eventTargetElement(event);
  if (target) {
    if (target.closest(SELECTABLE_UI)) {
      return;
    }
  }
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed && selection.toString().trim()) {
    return;
  }
  event.preventDefault();
}, true);

createRoot(document.getElementById("root")!).render(<App />);
