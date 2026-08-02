# Environment and auth

Expect `api_url`; optionally `token`/`api_key` depending on the API.
Default `headers:`
- User-Agent: Multimeter
- Accept: */*
- Connection: keep-alive
- Accept-Encoding: gzip, deflate, br

Block any with `_` if needed; Content-Type/Length are inferred when a body exists.
