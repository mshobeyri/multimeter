# Current tokens (`c:`)

Each name maps to a generator in `CURRENT_TOKEN_MAP`. Values reflect **now** in the runtime locale/time zone unless noted.

See also: [Dynamic values overview](./index.md) · [Random tokens](./random.md) · [Syntax and accessors](./syntax.md)

## Offsets and aliases

Temporal current tokens accept a signed offset such as `(+1h1m)` or `(-1d2m1s)`. The sign applies to the complete duration. Combined durations support `w`, `d`, `h`, `m`, `s`, and `ms`.

Examples:

- `c:date(+7d)`
- `c:datetime(-1d2m1s)`
- `c:utc_datetime(+1h1m)`
- `c:epoch(-30m)`

**Future/past aliases** use unsigned durations instead of signed offsets:

- `c:datetime_future(1h)` — one hour ahead
- `c:utc_datetime_past(2d)` — two days ago
- `c:epoch_future(30m)` — 30 minutes ahead
- `c:time_past(15m)` — 15 minutes ago

Offsets apply to date/time, weekday, month, year, epoch, and UTC-offset tokens. They are intentionally rejected for `c:city`, `c:country`, `c:timezone`, and git tokens.

## Generators

| Token | Returns | Example |
|-------|---------|---------|
| `c:time` | Local time `HH:MM:SS` | `14:32:08` |
| `c:date` | Local date `YYYY-MM-DD` | `2026-08-02` |
| `c:datetime` | Local date and time `YYYY-MM-DDTHH:MM:SS` | `2026-08-02T14:32:08` |
| `c:datetime_ms` | Local date and time with milliseconds | `2026-08-02T14:32:08.123` |
| `c:utc_time` | UTC time `HH:MM:SS` | `18:32:08` |
| `c:utc_date` | UTC date `YYYY-MM-DD` | `2026-08-02` |
| `c:utc_datetime` | UTC ISO date and time | `2026-08-02T18:32:08Z` |
| `c:utc_datetime_ms` | UTC ISO date and time with milliseconds | `2026-08-02T18:32:08.123Z` |
| `c:day` | Local weekday name | `Sunday` |
| `c:weekday_number` | ISO weekday number (Monday=1, Sunday=7) | `7` |
| `c:month` | Local month name | `August` |
| `c:year` | Local year (number) | `2026` |
| `c:epoch` | Unix seconds now (integer) | `1754165528` |
| `c:epoch_ms` | Unix milliseconds now (integer) | `1754165528123` |
| `c:timezone` | IANA runtime time zone | `Europe/Amsterdam` |
| `c:utc_offset` | Local offset from UTC | `+02:00` |
| `c:city` | City inferred from time zone (best effort) | `New York` |
| `c:country` | Country inferred from locale (best effort) | `United States` |

## Git (host-injected)

Resolved from the project / working tree at run time. When git is unavailable, string tokens resolve to `""` and `c:git_dirty` to `false`.

| Token | Returns | Example |
|-------|---------|---------|
| `c:branch` | Current branch name | `main` |
| `c:commit` | Full HEAD SHA | `a4f5e463…` (40 hex) |
| `c:commit_short` | Short HEAD SHA (8 hex chars) | `a4f5e463` |
| `c:tag` | Tag(s) pointing at HEAD (comma-separated if several) | `v1.45.3` |
| `c:git_describe` | `git describe --tags --always` | `v1.45.3-12-ga4f5e463` |
| `c:git_dirty` | Worktree has uncommitted changes (boolean) | `true` |
| `c:report_folder` | Path-safe folder for git-structured reports (see below) | `branch/dev/a4f5e463` |

### `c:report_folder`

Preferred relative folder for report trees:

| Situation | Value | Example |
|-----------|--------|---------|
| Exact tag on HEAD | `tags/<tag>` (first tag if several) | `tags/v1.45.3` |
| On a branch | `branch/<branch>/<commit>` | `branch/feature/x/a4f5e463` |
| Detached HEAD | `detached/<commit>` | `detached/a4f5e463` |
| No git | `local` | `local` |

## In export / report file paths

Any `c:` token can appear in suite/load `export:` paths and CLI `--report-file`. Tokens expand at write time; resolved values are path-sanitized (`:` → `-`, and other illegal filename characters).

```yaml
export:
  - +/reports/<<c:report_folder>>/results.html
  - +/reports/c:report_folder/results.xml
  - +/reports/<<c:date>>/run-<<c:commit_short>>.html
  - ./out-<<c:datetime>>.md
```

## Future/past aliases

These aliases accept one unsigned duration argument (for example `1h`, `2d4h`):

| Alias | Shifts |
|-------|--------|
| `c:time_future` / `c:time_past` | Local time |
| `c:utc_time_future` / `c:utc_time_past` | UTC time |
| `c:date_future` / `c:date_past` | Local date |
| `c:utc_date_future` / `c:utc_date_past` | UTC date |
| `c:datetime_future` / `c:datetime_past` | Local datetime |
| `c:datetime_ms_future` / `c:datetime_ms_past` | Local datetime with milliseconds |
| `c:utc_datetime_future` / `c:utc_datetime_past` | UTC datetime |
| `c:utc_datetime_ms_future` / `c:utc_datetime_ms_past` | UTC datetime with milliseconds |
| `c:epoch_future` / `c:epoch_past` | Unix seconds |
| `c:epoch_ms_future` / `c:epoch_ms_past` | Unix milliseconds |

**Total:** 25 generators and 20 future/past aliases.
