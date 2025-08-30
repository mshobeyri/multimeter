// Save variables to VSCode workspace state

import {EnvVariable} from './environment/EnvironmentData';

export function saveEnvVariablesFromObject(flatVars: EnvVariable[]) {
  console.log('Saving environment variables to workspace state:', flatVars);
  window.vscode?.postMessage({
    command: 'updateWorkspaceState',
    name: 'multimeter.environment.storage',
    value: flatVars,
  });
}

// Load variables from VSCode workspace state
export function loadEnvVariables(
    callback: (variables: EnvVariable[]) => void) {
  function handler(event: MessageEvent) {
    const message = event.data;
    if (message.command === 'loadWorkspaceState' &&
        message.name === 'multimeter.environment.storage') {
      callback(message.value || []);
    }
  }
  window.addEventListener('message', handler);
  window.vscode?.postMessage(
      {command: 'loadWorkspaceState', name: 'multimeter.environment.storage'});
  // Return a cleanup function
  return () => window.removeEventListener('message', handler);
}