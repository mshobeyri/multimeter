/** Attribute on key/value controls for Tab navigation in KV-style editors. */
export const KV_FIELD_ATTR = "data-mmt-kv-field";

export function kvFieldId(row: number, which: "key" | "value"): string {
  return `${which}-${row}`;
}

export function focusKvField(
  root: ParentNode | null | undefined,
  row: number,
  which: "key" | "value",
): boolean {
  if (!root) {
    return false;
  }
  const el = root.querySelector<HTMLElement>(
    `[${KV_FIELD_ATTR}="${kvFieldId(row, which)}"]`,
  );
  if (!el || (el as HTMLInputElement).disabled) {
    return false;
  }
  el.focus();
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const len = el.value?.length ?? 0;
    try {
      el.setSelectionRange(len, len);
    } catch {
      // Some input types do not support selection ranges.
    }
  }
  return true;
}

function listKvFields(root: ParentNode): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(`[${KV_FIELD_ATTR}]`),
  ).filter((el) => {
    if ((el as HTMLInputElement).disabled) {
      return false;
    }
    return true;
  });
}

function focusElement(el: HTMLElement): void {
  el.focus();
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const len = el.value?.length ?? 0;
    try {
      el.setSelectionRange(len, len);
    } catch {
      // ignore
    }
  }
}

/** Move to the next/previous `[data-mmt-kv-field]` inside `root`. */
export function moveKvFieldFocus(
  root: ParentNode,
  current: HTMLElement,
  reverse: boolean,
): boolean {
  const fields = listKvFields(root);
  const idx = fields.indexOf(current);
  if (idx < 0) {
    return false;
  }
  const nextIdx = reverse ? idx - 1 : idx + 1;
  if (nextIdx < 0 || nextIdx >= fields.length) {
    return false;
  }
  focusElement(fields[nextIdx]);
  return true;
}

/**
 * Tab / Shift+Tab between key and value fields in a KV/KSV table.
 * From a key field, Tab prefers that row's value (after paint if it just appeared).
 * Returns true when the event was handled (`preventDefault` already called).
 */
export function handleKvEditorTab(
  e: { key: string; shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean; preventDefault: () => void },
  root: HTMLElement | null | undefined,
): boolean {
  if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey) {
    return false;
  }
  if (!root) {
    return false;
  }

  const active = document.activeElement as HTMLElement | null;
  let current: HTMLElement | null = null;
  if (active?.hasAttribute(KV_FIELD_ATTR)) {
    current = active;
  } else if (active) {
    current = active.closest(`[${KV_FIELD_ATTR}]`);
  }
  if (!current || !root.contains(current)) {
    return false;
  }

  const id = current.getAttribute(KV_FIELD_ATTR) || "";
  const keyMatch = /^key-(\d+)$/.exec(id);
  if (keyMatch && !e.shiftKey) {
    const row = Number(keyMatch[1]);
    e.preventDefault();
    const tryFocus = (): boolean => {
      if (focusKvField(root, row, "value")) {
        return true;
      }
      return focusKvField(root, row + 1, "key");
    };
    if (!tryFocus()) {
      requestAnimationFrame(() => {
        if (!tryFocus()) {
          moveKvFieldFocus(root, current!, false);
        }
      });
    }
    return true;
  }

  if (moveKvFieldFocus(root, current, e.shiftKey)) {
    e.preventDefault();
    return true;
  }
  return false;
}
