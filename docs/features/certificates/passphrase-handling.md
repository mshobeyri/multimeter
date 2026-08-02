# Passphrase handling

For security, you can store passphrases in environment variables instead of the env `file:`

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
