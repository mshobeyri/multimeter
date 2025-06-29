// Save variables to VSCode workspace state
export function saveEnvVariablesFromObject(variables: Record<string, any>) {
  const flatVars: { name: string; label: string; value: string }[] = [];

  Object.entries(variables).forEach(([name, value]) => {
    if (Array.isArray(value)) {
      // For lists: label and value are the same
      value.forEach((item: string) => {
        flatVars.push({ name, label: item, value: item });
      });
    } else if (typeof value === "object" && value !== null) {
      // For objects: label is the key, value is the value
      Object.entries(value).forEach(([label, val]) => {
        flatVars.push({ name, label, value: String(val) });
      });
    }
  });

  window.vscode?.postMessage({
    command: "updateWorkspaceState",
    name: "multimeter.env.variables",
    value: flatVars,
  });
}

// Load variables from VSCode workspace state
export function loadEnvVariables(callback: (variables: { name: string; label: string; value: string }[]) => void) {
  function handler(event: MessageEvent) {
    const message = event.data;
    if (message.command === "loadWorkspaceState" && message.name === "multimeter.env.variables") {
      callback(message.value || []);
    }
  }
  window.addEventListener("message", handler);
  window.vscode?.postMessage({ command: "loadWorkspaceState", name: "multimeter.env.variables" });
  // Return a cleanup function
  return () => window.removeEventListener("message", handler);
}