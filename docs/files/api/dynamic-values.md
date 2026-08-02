# Dynamic values: random and current
Use built-in dynamic tokens anywhere in url, headers, body, query, cookies, or even in inputs defaults.

Syntax
- Random: `r:<name>` or `<<r:<name>>>`
- Current: `c:<name>` or `<<c:<name>>>`
- Environment: `e:<NAME>` or `<<e:NAME>>`

Resolution rules
- If a field’s value is exactly a single token (e.g. `body: r:int`), the value keeps its native type (number/boolean/string), not a string.
- If a token appears inline within other text, it’s replaced as a string (e.g. `X-Id: user-<<r:uuid>>`).

Common random tokens (`r:`)
- uuid, bool, int
- ip, ipv6
- email, phone
- first_name, last_name, full_name, country
- color
- epoch, epoch_ms
- epoch_past, epoch_past_ms
- epoch_recent, epoch_recent_ms
- epoch_future, epoch_future_ms
- latitude, longitude
- hex_color
- weekday, month
- date_future, date_past, date_recent
- phone_number (alias for phone)

Common current tokens (`c:`)
- time, date, day, month, year
- epoch, epoch_ms
- city, country (best effort based on your locale/time zone)

Token name normalization: `r:firstName`, `r:first-name`, and `r:first_name` all resolve to the same token. Underscores, hyphens, and casing are ignored when matching token names.

Examples
```yaml
headers:
  X-Req: req-<<r:uuid>>
  X-Now: <<c:date>> <<c:time>>
body:
  id: r:int
  created_at: c:epoch
  active: r:bool
```

CLI and UI both resolve these tokens consistently. Random values are cached per render to keep the UI stable while editing.
