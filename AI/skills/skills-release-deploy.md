# Release & deploy

## Versions

Only these files are bumped:

| File | Stable `release X.Y.Z` | Pre-release |
|---|---|---|
| `package.json` (VS Code extension) | `X.Y.Z` | `X.Y.Z` (Marketplace forbids `-pre`) |
| `mmtcli/package.json` | `X.Y.Z` | `X.Y.Z-pre` |
| `mmtmcp/package.json` | `X.Y.Z` | `X.Y.Z-pre` |
| `mmtmcp/server.json` | same as MCP `package.json` | same as MCP `package.json` |

- **release X.Y.Z** → all three `package.json` files are `X.Y.Z`, tag `vX.Y.Z` (stable).
- **pre-release X.Y.Z** → extension `X.Y.Z`, CLI and MCP `X.Y.Z-pre`, tag `vX.Y.Z-pre`.
- npm: `mmt-testlight` and `mmt-mcp` always publish together with the same version and dist-tag (`latest` or `pre`).

```bash
node scripts/sync-versions.mjs --set 1.42.3      # or 1.42.3-pre
# CHANGELOG.md → ## [1.42.3] or ## [1.42.3-pre]
npm run compile --silent
npm run pack              # stable local VSIX
# npm run pack-pre-release  # pre-release local VSIX (same Marketplace version, --pre-release)
# commit: Release version 1.42.3   (or 1.42.3-pre)
git tag v1.42.3 && git push origin v1.42.3       # or v1.42.3-pre
```

Whenever the user asks to **release**, **pre-release**, or **create a version**, always pack a local VS Code VSIX after versions are set (`pack` or `pack-pre-release`). Do not wait to be asked. The VSIX is gitignored (`multimeter-X.Y.Z.vsix` at repo root).

CI (`.github/workflows/release-testlight.yml`) publishes from the tag: **build → GitHub Release**, then Docker, npm, Homebrew (stable only), and the GitHub Action. A failed build or GitHub Release stops the rest. Missing publish secrets fail the job. VS Code Marketplace is **not** published from CI (local VSIX only).

| Tag | npm | Docker | GitHub | Homebrew | Action |
|---|---|---|---|---|---|
| `vX.Y.Z` | `@latest` | `:latest` | latest + `@v1` | tap `mmt-testlight` | `@vX.Y.Z` + `@v1` |
| `vX.Y.Z-pre` | `@pre` | `:pre` | prerelease | skipped | `@vX.Y.Z-pre` |

Secrets: `NPM_TOKEN`, `DOCKERHUB_*`, `TESTLIGHT_ACTION_TOKEN`, `HOMEBREW_TAP_TOKEN` (stable Homebrew; Action token is a fallback). Marketplace stays manual (`VSCE_PAT`).

Do not put versions in comments, READMEs, the GitHub Action default, or website copy. Do not bump lockfiles or `.cursor-plugin/plugin.json` as part of a release. `mmtmcp/server.json` is set by `scripts/sync-versions.mjs` to the MCP npm version.

## Pack (always, local)

Root `package.json` is already `X.Y.Z`. Use `EXTENSION.md` as the readme. Always run this when creating a version.

```bash
npm run pack              # stable
npm run pack-pre-release  # same version, --pre-release flag
```

## Binaries

`@yao-pkg/pkg` SEA, Node 22, `--compress Brotli -c package.json` (enhanced SEA; simple `pkg file.js --sea` cannot compress), bundle via `mmtcli/esbuild.mjs --pkg`. Host Node ≥ 22. From `mmtcli`: `npm exec --no -- pkg` (not `npx pkg`). Windows icon: `scripts/apply-windows-icon.mjs` after pack. Layout: `bin/<platform>/testlight`.

## Other channels

- **Homebrew**: CI updates tap `mshobeyri/homebrew-multimeter` after a **stable** GitHub Release (`scripts/publish-homebrew.sh`).
- **Action**: `.github/actions/testlight/` ↔ `mshobeyri/testlight-action`. Default install is `mmt-testlight@latest`.
- **MCP Registry**: `server.json` version tracks npm `mmt-mcp`. Publishing that file to the official MCP Registry is still separate from the npm job.
- **Cursor plugin**: set `.cursor-plugin/plugin.json` when publishing that plugin.
