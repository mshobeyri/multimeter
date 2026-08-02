# Certificates

SSL/TLS certificate configuration in MMT has two parts:
1. **File paths** - stored in the `certificates` section of the env file (YAML)
2. **Enable/disable settings** - stored in local storage (VS Code workspace state or CLI defaults)

This separation allows certificate file paths to be version-controlled while keeping enable/disable toggles as local preferences.

## In this section

- [Supported certificate formats](./supported-certificate-formats.md)
- [Example certificate configuration](./example-certificate-configuration.md)
- [Certificate fields (YAML)](./certificate-fields-yaml.md)
- [Enable/disable settings (local storage)](./enable-disable-settings-local-storage.md)
- [Passphrase handling](./passphrase-handling.md)
- [Edit certificates in the UI](./edit-certificates-in-the-ui.md)
- [Host matching rules](./host-matching-rules.md)
- [Migration from VS Code settings](./migration-from-vs-code-settings.md)
