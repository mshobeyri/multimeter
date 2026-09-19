# Random tokens (`r:`)

Each name maps to a generator in `RANDOM_TOKEN_MAP`. Unless noted, values are **strings**. Token names accept underscores, hyphens, and camelCase aliases via [name normalization](./syntax.md#name-normalization) (e.g. `r:firstName` → `first_name`).

See also: [Dynamic values overview](./index.md) · [Current tokens](./current.md) · [Syntax and accessors](./syntax.md)

## Identifiers and primitives

| Token | Returns | Example |
|-------|---------|---------|
| `r:uuid` | UUID v4 string | `a1b2c3d4-e5f6-4789-a012-3456789abcde` |
| `r:bool` | Boolean | `true` |
| `r:int` | Integer `0`–`1000` | `742` |
| `r:float` | Floating-point number `0`–`1000` | `42.75` |
| `r:string` | Alphabetic string (16 characters) | `aZbYcXwVuTsRqPon` |
| `r:alphanumeric` | Letters and digits (16 characters) | `aB3dE5gH7jK9mN2p` |

### Parameterized forms

| Token | Meaning |
|-------|---------|
| `r:int(1,100)` | Integer in the inclusive range 1–100 |
| `r:int(100)` | Integer in the inclusive range 0–100 |
| `r:float(1.5,9.5)` | Floating-point number in the range 1.5–9.5 |
| `r:string(32)` | Alphabetic string with length 32 |
| `r:alphanumeric(24)` | Alpha-numeric string with length 24 |
| `r:password(20)` | Password string with length 20 |
| `r:epoch(1700000000,1800000000)` | Unix seconds in an explicit inclusive range |
| `r:epoch_ms(1700000000000,1800000000000)` | Unix milliseconds in an explicit inclusive range |
| `r:date_future(1,30)` | Date between 1 and 30 days in the future |
| `r:date_past(1,30)` | Date between 1 and 30 days in the past |
| `r:date_future(2d,30d)` | Date between 2 and 30 days ahead (duration syntax) |
| `r:datetime_future(1d,7d)` | Local datetime between 1 and 7 days ahead |
| `r:datetime_past(2d,14d)` | Local datetime between 2 and 14 days ago |
| `r:utc_datetime_future(1d,7d)` | UTC datetime between 1 and 7 days ahead |
| `r:utc_datetime_past(2d,14d)` | UTC datetime between 2 and 14 days ago |
| `r:time_future(1h,6h)` | Local time between 1 and 6 hours ahead |
| `r:utc_time_past(30m,2h)` | UTC time between 30 minutes and 2 hours ago |
| `r:utc_date_future(7,30)` | UTC date between 7 and 30 days ahead |
| `r:epoch_future(2d,30d)` | Unix seconds between 2 and 30 days ahead |
| `r:epoch_past(1d,365d)` | Unix seconds between 1 day and 1 year ago |
| `r:datetime(2026-01-01,2026-12-31)` | Local datetime between two absolute local dates/times |
| `r:utc_datetime(2026-01-01T00:00:00Z,2026-12-31T23:59:59Z)` | UTC datetime between two absolute instants |
| `r:datetime_now(1h1m)` | Local datetime within ±1 hour 1 minute of now |
| `r:datetime_now(2h,1d)` | Local datetime from 2 hours ago through 1 day ahead |
| `r:utc_datetime_now(1h1m)` | UTC datetime within ±1 hour 1 minute of now |
| `r:utc_datetime_now(2h,1d)` | UTC datetime from 2 hours ago through 1 day ahead |
| `r:epoch_now(1h1m)` | Unix seconds within ±1 hour 1 minute of now |
| `r:epoch_now(2h,1d)` | Unix seconds from 2 hours ago through 1 day ahead |
| `r:epoch_now_ms(1h1m)` | Unix milliseconds within ±1 hour 1 minute of now |
| `r:epoch_now_ms(2h,1d)` | Unix milliseconds from 2 hours ago through 1 day ahead |

Invalid arguments and arguments on non-parameterized tokens remain unresolved instead of silently producing a different value.

Relative-to-now ranges accept combined `w`, `d`, `h`, `m`, `s`, and `ms` durations, for example `2d4h30m` or `1h1m`. For `*_now` tokens:

- **One argument** — symmetric range around now, e.g. `r:datetime_now(1h1m)` → ±1h1m
- **Two arguments** — back then forward from now, e.g. `r:datetime_now(2h,1d)` → from 2 hours ago through 1 day ahead
- **No arguments** — defaults to ±1 hour

Future/past random tokens accept **day counts** (`7`, `30`) or **combined durations** (`2d4h`, `1h30m`). One argument sets the maximum offset from now; two arguments set a min/max window.

## Network

| Token | Returns | Example |
|-------|---------|---------|
| `r:ip` | IPv4 address | `203.0.113.42` |
| `r:ipv6` | IPv6 address (8 groups) | `2001:0db8:85a3:0000:0000:8a2e:0370:7334` |
| `r:mac` | MAC address | `02:42:ac:11:00:02` |
| `r:domain` | Domain name | `example.com` |
| `r:hostname` | Host name | `api-a1b2c3d4.example.com` |
| `r:url` | HTTPS URL | `https://api-a1b2c3d4.example.com/x7y8z9` |
| `r:user_agent` | Common HTTP user-agent string | `curl/8.7.1` |

## People and contact

| Token | Returns | Example |
|-------|---------|---------|
| `r:email` | Email address | `jane.doe42@example.com` |
| `r:username` | Name-based username | `jane.doe42` |
| `r:password` | Password string (16 characters) | `aB3!dE5_fG7+hJ9` |
| `r:phone` | E.164 phone number | `+14155550123` |
| `r:phone_number` | Alias for `r:phone` | `+442071234567` |
| `r:first_name` | First name | `Jane` |
| `r:last_name` | Last name | `Doe` |
| `r:full_name` | `"<first> <last>"` | `Jane Doe` |

## Place and geo

| Token | Returns | Example |
|-------|---------|---------|
| `r:city` | City name (curated list) | `Berlin` |
| `r:country` | Country name (curated list) | `Germany` |
| `r:latitude` | Number, −90…90 | `48.8566` |
| `r:longitude` | Number, −180…180 | `2.3522` |
| `r:postal_code` | Five-digit postal code | `10115` |
| `r:street_address` | Synthetic street address | `42 Miller Street` |

## Business and text

| Token | Returns | Example |
|-------|---------|---------|
| `r:company` | Synthetic company name | `Miller Technologies` |
| `r:job_title` | Software/business job title | `Backend Engineer` |
| `r:word` | Word from a technical vocabulary | `gateway` |
| `r:sentence` | Synthetic sentence | `Request data flows through the gateway.` |
| `r:paragraph` | Three to six synthetic sentences | `Request data ... Service response ...` |

## Color

| Token | Returns | Example |
|-------|---------|---------|
| `r:color` | CSS color name (palette) | `teal` |
| `r:hex_color` | `#RRGGBB` hex color | `#1a2b3c` |

## Calendar (random, not “now”)

| Token | Returns | Example |
|-------|---------|---------|
| `r:weekday` | Weekday name | `Wednesday` |
| `r:month` | Month name | `March` |
| `r:time` | Random local time `HH:MM:SS`; optional absolute from/to range | `08:30:12` |
| `r:utc_time` | Random UTC time `HH:MM:SS`; optional absolute from/to range | `18:30:12` |
| `r:date` | Random local date `YYYY-MM-DD`; optional absolute from/to range | `2027-04-14` |
| `r:utc_date` | Random UTC date `YYYY-MM-DD`; optional absolute from/to range | `2027-04-14` |
| `r:date_future` | Future date string (~1–365 days ahead) | `Mon Apr 14 2027 …` |
| `r:date_past` | Past date string (~1 day–5 years back) | `Tue Jan 09 2021 …` |
| `r:datetime` | Random local datetime; accepts an absolute local from/to range | `2027-04-14T08:30:12` |
| `r:utc_datetime` | Random UTC datetime; accepts an absolute from/to range | `2027-04-14T08:30:12Z` |
| `r:datetime_future` | Random local datetime in the future; duration or day-count window | `2026-09-19T12:00:00` |
| `r:datetime_past` | Random local datetime in the past; duration or day-count window | `2026-09-15T12:00:00` |
| `r:utc_datetime_future` | Random UTC datetime in the future | `2026-09-19T12:00:00Z` |
| `r:utc_datetime_past` | Random UTC datetime in the past | `2026-09-15T12:00:00Z` |
| `r:time_future` | Random local time in the future | `13:00:00` |
| `r:time_past` | Random local time in the past | `11:00:00` |
| `r:utc_time_future` | Random UTC time in the future | `13:00:00` |
| `r:utc_time_past` | Random UTC time in the past | `11:00:00` |
| `r:utc_date_future` | Random UTC date in the future | `2026-09-24` |
| `r:utc_date_past` | Random UTC date in the past | `2026-09-10` |
| `r:datetime_now` | Random local datetime around now; one duration for ±range, or back then forward | `2026-09-17T12:25:00` |
| `r:utc_datetime_now` | Random UTC datetime around now; one duration for ±range, or back then forward | `2026-09-17T10:25:00Z` |

## Epoch (random timestamps)

| Token | Returns | Range / meaning |
|-------|---------|-----------------|
| `r:epoch` | Unix seconds (integer) | Defaults to 2000–2035; accepts explicit epoch range |
| `r:epoch_ms` | Unix milliseconds (integer) | Defaults to 2000–2035; accepts explicit epoch range |
| `r:epoch_future` | Unix seconds | ~1–365 days in the future |
| `r:epoch_future_ms` | Unix milliseconds | ~1–365 days in the future |
| `r:epoch_past` | Unix seconds | ~1 day–5 years in the past |
| `r:epoch_past_ms` | Unix milliseconds | ~1 day–5 years in the past |
| `r:epoch_now` | Unix seconds around now; one duration for ±range, or back then forward | `r:epoch_now(2h,1d)` |
| `r:epoch_now_ms` | Unix milliseconds around now; one duration for ±range, or back then forward | `r:epoch_now_ms(2h,1d)` |

**Total:** 62 token names (`phone_number` is an alias for `phone`).
