# Release & deploy

## Versions

Only these files are bumped:

| File | Stable `release X.Y.Z` | Pre-release |
|---|---|---|
| `package.json` (VS Code extension) | `X.Y.Z` | `X.Y.Z` (Marketplace forbids `-pre`) |
| `mmtcli/package.json` | `X.Y.Z` | `X.Y.Z-pre` |
| `mmtmcp/package.json` | `X.Y.Z` | `X.Y.Z-pre` |

- **release X.Y.Z** → all three are `X.Y.Z`, tag `vX.Y.Z` (stable).
- **pre-release X.Y.Z** → extension `X.Y.Z`, CLI and MCP `X.Y.Z-pre`, tag `vX.Y.Z-pre`.

```bash
node scripts/sync-versions.mjs --set 1.42.3      # or 1.42.3-pre
# CHANGELOG.md → ## [1.42.3] or ## [1.42.3-pre]
# commit: Release version 1.42.3   (or 1.42.3-pre)
git tag v1.42.3 && git push origin v1.42.3       # or v1.42.3-pre
```

CI (`.github/workflows/release-testlight.yml`) publishes from the tag.

| Tag | npm | Docker | Marketplace | GitHub |
|---|---|---|---|---|
| `vX.Y.Z` | `@latest` | `:latest` | `X.Y.Z` stable | latest + `@v1` |
| `vX.Y.Z-pre` | `@pre` | `:pre` | `X.Y.Z` + `--pre-release` | prerelease |

Secrets: `NPM_TOKEN`, `DOCKERHUB_*`, `TESTLIGHT_ACTION_TOKEN`, `VSCE_PAT`. Missing secrets skip that job.

Do not put versions in comments, READMEs, the GitHub Action default, or website copy. Do not bump lockfiles, `.cursor-plugin/plugin.json`, or `mmtmcp/server.json` as part of a release.

## Pack (optional, local)

Root `package.json` is already `X.Y.Z`. Use `EXTENSION.md` as the readme.

```bash
npm run pack              # stable
npm run pack-pre-release  # same version, --pre-release flag
```

## Binaries

`@yao-pkg/pkg` SEA, Node 22, bundle via `mmtcli/esbuild.pkg.mjs`. Host Node ≥ 22. From `mmtcli`: `npm exec --no -- pkg` (not `npx pkg`). Windows icon: `scripts/apply-windows-icon.mjs` after pack. Layout: `bin/<platform>/testlight`.

## Other channels

- **Homebrew**: `packaging/homebrew/mmt-testlight.rb` → tap `mshobeyri/homebrew-multimeter` (checksums after a GitHub Release).
- **Action**: `.github/actions/testlight/` ↔ `mshobeyri/testlight-action`. Default install is `mmt-testlight@latest`.
- **MCP Registry**: set `mmtmcp/server.json` when publishing to the registry.
- **Cursor plugin**: set `.cursor-plugin/plugin.json` when publishing that plugin.
