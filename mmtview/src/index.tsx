import { createRoot } from "react-dom/client";
import App from "./App";

document.addEventListener("contextmenu", event => {
  const target = event.target;
  if (target instanceof Element) {
    // Allow native Copy/Select All on report/history body text and form fields.
    if (
      target.closest(
        "pre, textarea, input, .highlighted-body, .highlighted-body-pre, .report-selectable, .report-headers-content"
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
