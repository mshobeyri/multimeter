// Save variables to VSCode workspace state

export function saveEnvVariablesFromObject(flatVars: { name: string; label: string; value: string }[]) {
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