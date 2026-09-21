import { createRoot } from "react-dom/client";
import "./vendor/codicons/codicon.css";
import App from "./App";

document.addEventListener("contextmenu", event => {
  const target = event.target;
  if (target instanceof Element) {
    // Allow native Copy/Select All on report/history body text and form fields.
    if (
      target.closest(
        "pre, textarea, input, [contenteditable=\"true\"], .highlighted-body, .highlighted-body-pre, .report-selectable, .report-headers-content, .doc-preview, .doc-preview-body"
      )
    ) {
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
