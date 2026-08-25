# Edit certificates in the UI

In the env file editor, switch to the **Certificates** tab to:
- Configure the server CA certificate path (stored in YAML)
- Manage client certificates for mTLS (paths in YAML, enable/disable locally)

For each client, the **Certificate** dropdown chooses **Cert + Key** (PEM) or **PFX / P12** (PKCS#12). Unused file fields stay visible but disabled. YAML should set either `cert` + `key`, or `pfx`, not both.

The **Passphrase** dropdown chooses **Env var** (`passphrase_env`) or **Plain** (`passphrase_plain`). The unused passphrase field stays visible but disabled. YAML should set one of those fields, not both. Leave both empty if the key or bundle is unencrypted.
