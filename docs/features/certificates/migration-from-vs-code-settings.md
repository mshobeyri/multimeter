# Migration from VS Code settings

Previously, certificate settings were stored in VS Code workspace settings. These settings are now deprecated and will be ignored. To migrate:

1. Open your env file (e.g., `_environments.mmt`)
2. Switch to the **Certificates** tab in the editor
3. Configure your certificate file paths (saved to YAML)
4. Toggle enable/disable settings as needed (saved locally)

This ensures that certificate file paths are portable and can be version-controlled, while local preferences remain workspace-specific.
