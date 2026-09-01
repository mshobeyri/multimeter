# Passphrase handling

For security, store passphrases in an environment variable (`passphrase_env`) instead of in the env file (`passphrase_plain`). Set one of those fields, not both.

```yaml
clients:
  - name: "Secure API"
    host: "secure.api.com"
    cert: "./certs/client.pem"
    key: "./certs/client.key"
    passphrase_env: "MY_CERT_PASSPHRASE"  # Will read from $MY_CERT_PASSPHRASE
```

Then set the environment variable before running:

```sh
export MY_CERT_PASSPHRASE="secret123"
testlight run test.mmt --env-file env.mmt
```
