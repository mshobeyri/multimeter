# Host matching rules

Client certificate selection is based on the request host, with optional port matching:

- `*` matches any host on any port
- `*:*` matches any host on any port
- `example.com` matches only `example.com`
- `*.example.com` matches one subdomain label like `test.example.com`, but not `example.com` or `deep.test.example.com`
- `api.example.com:8443` restricts the match to that port
- `*:8085` matches any host on port `8085`
