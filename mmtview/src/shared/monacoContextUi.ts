/** DiffEditor teardown breaks YAML context menus; remount restores them. */
export const REMOUNT_YAML_MONACO_EVENT = "mmt:remount-yaml-monaco";

export function requestYamlMonacoRemount(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(REMOUNT_YAML_MONACO_EVENT));
}
