# Release & Deployment Skills

Comprehensive reference for building, packaging, and publishing Multimeter across all supported platforms and channels.

---

## Overview of Distribution Channels

| Channel | Package / Artifact | Registry / Host | Identifier |
|---|---|---|---|
| **VS Code Extension** | `multimeter-X.Y.Z.vsix` | [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter) | `mshobeyri.multimeter` |
| **npm** | `mmt-testlight` | [npmjs.com](https://www.npmjs.com/package/mmt-testlight) | `mmt-testlight` |
| **Docker** | `mshobeyri/mmt-testlight` | [Docker Hub](https://hub.docker.com/r/mshobeyri/mmt-testlight) | `mshobeyri/mmt-testlight` |
| **Homebrew** | `mmt-testlight` formula | [mshobeyri/multimeter tap](https://github.com/mshobeyri/homebrew-multimeter) | `mshobeyri/multimeter/mmt-testlight` |
| **GitHub Releases** | Platform binaries + checksums | [GitHub](https://github.com/mshobeyri/multimeter/releases) | Tag: `vX.Y.Z` |
| **GitHub Action** | Composite action | `mshobeyri/multimeter` repo under `bin/github-action/` | `mshobeyri/multimeter@vX` |
| **One-line installer** | Shell script | Raw GitHub URL | `scripts/install-testlight.sh` |
| **Standalone binaries** | macOS x64/arm64, Linux x64/arm64, Windows x64 | GitHub Releases | `testlight-vX.Y.Z-<platform>.<ext>` |

---

## Version Tracking

Versions live in **three** places that must stay in sync:

| File | Field | Scope |
|---|---|---|
| `package.json` (root) | `"version"` | VS Code extension |
| `mmtcli/package.json` | `"version"` | CLI (`mmt-testlight` on npm, Docker, binaries) |
| `packaging/homebrew/mmt-testlight.rb` | `version` + `sha256` hashes | Homebrew formula |

The extension and CLI versions are independent. The CLI version is derived from `mmtcli/package.json` by all release scripts.

---

## 1. VS Code Extension

### Build

```bash
npm run compile          # full build: core → webview → extension typecheck + lint + esbuild
vsce package             # produces multimeter-X.Y.Z.vsix
vsce package --pre-release  # for pre-release builds
```

### Publish

```bash
# Login once (needs a Personal Access Token from https://dev.azure.com)
vsce login mshobeyri

# Publish stable
vsce publish

# Publish pre-release
vsce publish --pre-release
```

### Tokens / Secrets

| Secret | Where | Purpose |
|---|---|---|
| Azure DevOps PAT | Local / CI | `vsce login` and `vsce publish` |

### Notes

- The `.vscodeignore` file controls what goes into the `.vsix`. Verify excluded folders after adding new top-level dirs.
- Always run `npm run compile` successfully before packaging.
- The `"version"` in root `package.json` is the extension version shown in Marketplace.

---

## 2. npm (`mmt-testlight`)

### Build

```bash
cd core && npm run build     # compile core TypeScript
cd mmtcli && npm run build   # bundle CLI with esbuild
```

### Publish

```bash
# Stable
cd mmtcli && npm publish --access public

# Pre-release (tagged)
cd mmtcli && npm publish --access public --tag beta
cd mmtcli && npm publish --access public --tag rc
```

### Tokens / Secrets

| Secret | Where | Purpose |
|---|---|---|
| `NPM_TOKEN` | GitHub Actions secret | `npm publish` in CI |
| `~/.npmrc` | Local | `npm login` stores auth locally |

### Verify

```bash
npm view mmt-testlight version           # latest stable
npm view mmt-testlight dist-tags         # all tags (latest, beta, rc)
npx mmt-testlight --version              # quick test
```

---

## 3. Docker (`mshobeyri/mmt-testlight`)

### Build

```bash
docker build -t mshobeyri/mmt-testlight:latest .
docker tag mshobeyri/mmt-testlight:latest mshobeyri/mmt-testlight:X.Y.Z
```

### Push

```bash
docker login                             # interactive login
docker push mshobeyri/mmt-testlight:latest
docker push mshobeyri/mmt-testlight:X.Y.Z
```

### Update Docker Hub README

```bash
./scripts/update-dockerhub-readme.sh
# Reads from: packaging/docker/README.md
# Requires: DOCKERHUB_USERNAME + DOCKERHUB_TOKEN (or interactive prompt)
```

### Tokens / Secrets

| Secret | Where | Purpose |
|---|---|---|
| `DOCKERHUB_USERNAME` | GitHub Actions secret / env | Docker Hub login |
| `DOCKERHUB_TOKEN` | GitHub Actions secret / env | Docker Hub PAT ([create here](https://hub.docker.com/settings/security)) |

### Key Files

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage build (builder → runtime on `node:18-alpine`) |
| `.dockerignore` | Excludes `node_modules`, `dist`, `src`, etc. from build context |
| `packaging/docker/README.md` | Docker Hub repository overview (version-controlled) |
| `scripts/update-dockerhub-readme.sh` | Pushes README to Docker Hub via API |

### Known Issues

- `res/doc-template.html` must be copied in Dockerfile (`COPY res/doc-template.html res/doc-template.html`) — the `prebuild` script needs it to generate `docTemplate.ts`.
- esbuild binary mismatch: the `.dockerignore` must exclude `node_modules` to prevent host platform binaries leaking into the Alpine container. If esbuild version errors occur, run `npm rebuild esbuild` inside the build stage.

---

## 4. Homebrew (`mmt-testlight`)

### Formula Location

- **Source**: `packaging/homebrew/mmt-testlight.rb`
- **Tap repo**: `https://github.com/mshobeyri/homebrew-multimeter`

### Update Steps (after a release)

1. Build binaries: `./scripts/build-binaries.sh`
2. Upload archives to GitHub Release (done by CI or `release-testlight.sh --publish-github`)
3. Compute SHA-256 checksums of the platform `.tar.gz` files:
   ```bash
   shasum -a 256 dist-release/testlight-vX.Y.Z-macos-arm64.tar.gz
   shasum -a 256 dist-release/testlight-vX.Y.Z-macos-x64.tar.gz
   shasum -a 256 dist-release/testlight-vX.Y.Z-linux-x64.tar.gz
   shasum -a 256 dist-release/testlight-vX.Y.Z-linux-arm64.tar.gz
   ```
4. Update `packaging/homebrew/mmt-testlight.rb`:
   - `version "X.Y.Z"`
   - Each `sha256` value for the corresponding platform URL
5. Copy updated formula to the tap repo and push:
   ```bash
   cp packaging/homebrew/mmt-testlight.rb /path/to/homebrew-multimeter/Formula/mmt-testlight.rb
   cd /path/to/homebrew-multimeter && git add . && git commit -m "Update mmt-testlight to X.Y.Z" && git push
   ```

### Install / Test

```bash
brew tap mshobeyri/multimeter
brew install mmt-testlight
brew upgrade mmt-testlight
testlight --version
```

### Notes

- The formula downloads pre-built binaries from GitHub Releases — no compilation.
- Supports macOS (x64 + arm64) and Linux (x64 + arm64).
- Both `testlight` and `mmt` commands are installed (`mmt` is a symlink).

---

## 5. GitHub Releases (Standalone Binaries)

### Platforms

| Platform | Archive | Binary |
|---|---|---|
| macOS x64 | `testlight-vX.Y.Z-macos-x64.tar.gz` | `testlight` + `mmt` (symlink) |
| macOS arm64 | `testlight-vX.Y.Z-macos-arm64.tar.gz` | `testlight` + `mmt` (symlink) |
| Linux x64 | `testlight-vX.Y.Z-linux-x64.tar.gz` | `testlight` + `mmt` (symlink) |
| Linux arm64 | `testlight-vX.Y.Z-linux-arm64.tar.gz` | `testlight` + `mmt` (symlink) |
| Windows x64 | `testlight-vX.Y.Z-win-x64.zip` | `testlight.exe` + `mmt.exe` (copy) |

### Build Locally

```bash
./scripts/build-binaries.sh                        # all platforms
./scripts/build-binaries.sh macos-arm64 linux-x64  # specific platforms
```

Output goes to `bin/<platform>/`. Checksums written to `bin/checksums-sha256.txt`.

### Create Release

```bash
# Via script (requires `gh` CLI)
./scripts/release-testlight.sh --publish-github

# Manually
gh release create vX.Y.Z \
  --title "testlight vX.Y.Z" \
  --notes "See CHANGELOG.md" \
  dist-release/testlight-vX.Y.Z-*.tar.gz \
  dist-release/testlight-vX.Y.Z-*.zip \
  dist-release/checksums-sha256.txt
```

### Pre-release

```bash
gh release create vX.Y.Z-beta.1 --prerelease ...
```

---

## 6. GitHub Action

### Location

- `bin/github-action/action.yml` — composite action definition
- `bin/github-action/README.md` — usage docs

### Usage (for consumers)

```yaml
- uses: mshobeyri/multimeter@v1
  with:
    file: tests/suite.mmt
    env-file: env/staging.mmt
    report: junit
    report-file: results/report.xml
```

### How It Works

1. Sets up Node.js 18
2. Installs `mmt-testlight` globally via npm (supports `version: latest | beta | rc | X.Y.Z`)
3. Runs `testlight <command> <file>` with all configured flags
4. Outputs: `result`, `report`, `exit-code`

### Update Steps

The action installs from npm, so no binary update is needed — just publish to npm and consumers get the new version.

---

## 7. One-Line Installer Script

### Location

- `scripts/install-testlight.sh` (also copied to `bin/install.sh` during build)

### Usage

```bash
# Latest stable
curl -fsSL https://raw.githubusercontent.com/mshobeyri/multimeter/main/scripts/install-testlight.sh | bash

# Specific version
VERSION=0.3.1 curl -fsSL .../install-testlight.sh | bash

# Pre-release
PRERELEASE=1 curl -fsSL .../install-testlight.sh | bash
CHANNEL=beta curl -fsSL .../install-testlight.sh | bash
```

### How It Works

1. Detects OS (macos/linux/win) and architecture (x64/arm64)
2. Resolves version from GitHub API (latest stable, or pre-release by channel)
3. Downloads the platform archive from GitHub Releases
4. Extracts and installs to `/usr/local/bin` (or `~/.local/bin`)
5. Creates `mmt` symlink

---

## Automated CI Release (GitHub Actions)

### Trigger

Push a version tag:

```bash
git tag v0.3.1 && git push origin v0.3.1          # stable
git tag v0.4.0-beta.1 && git push origin v0.4.0-beta.1  # pre-release
```

### Workflow: `.github/workflows/release-testlight.yml`

| Job | What It Does |
|---|---|
| `build` | Builds `pkg` binaries for all 5 platforms (matrix), creates archives + checksums |
| `docker` | Builds and pushes Docker image (`mshobeyri/mmt-testlight:X.Y.Z` + float tag) |
| `npm` | Publishes `mmt-testlight` to npm (`@latest` or `@beta`/`@rc`) |
| `release` | Downloads all artifacts, creates GitHub Release with archives + checksums |

### Pre-release Detection

Automatic from tag format: `vX.Y.Z-beta.N`, `vX.Y.Z-rc.N`, etc.
- npm dist-tag matches channel name (`beta`, `rc`, `alpha`)
- Docker float tag matches channel name
- GitHub Release marked as pre-release

### Required GitHub Secrets

| Secret | Purpose |
|---|---|
| `NPM_TOKEN` | npm publish |
| `DOCKERHUB_USERNAME` | Docker Hub login |
| `DOCKERHUB_TOKEN` | Docker Hub push |

Note: GitHub Release creation uses the built-in `GITHUB_TOKEN` (via `permissions: contents: write`).

---

## Local Full Release Script

```bash
# Build + package only (no publishing)
./scripts/release-testlight.sh

# Build + publish everywhere
./scripts/release-testlight.sh --publish

# Selective publishing
./scripts/release-testlight.sh --publish-npm
./scripts/release-testlight.sh --publish-github
./scripts/release-testlight.sh --publish-docker

# Pre-release
VERSION=0.4.0-beta.1 ./scripts/release-testlight.sh --publish --pre-release
```

### What It Does

1. Builds platform binaries (`build-binaries.sh`)
2. Creates `.tar.gz` / `.zip` archives in `dist-release/`
3. Builds Docker image
4. Optionally: publishes to npm, creates GitHub Release, pushes Docker image

---

## Complete Release Checklist

### For CLI release (testlight vX.Y.Z):

- [ ] Update `mmtcli/package.json` version to `X.Y.Z`
- [ ] Update `CHANGELOG.md` with changes
- [ ] Run tests: `npm run test`
- [ ] Run compile: `npm run compile`
- [ ] Build and test Docker locally:
  ```bash
  docker build -t mshobeyri/mmt-testlight:X.Y.Z .
  docker run --rm mshobeyri/mmt-testlight:X.Y.Z --version
  ```
- [ ] Publish npm: `cd mmtcli && npm publish --access public`
- [ ] Push Docker: `docker push mshobeyri/mmt-testlight:X.Y.Z && docker push mshobeyri/mmt-testlight:latest`
- [ ] Update Docker Hub README: `./scripts/update-dockerhub-readme.sh`
- [ ] Build binaries: `./scripts/build-binaries.sh`
- [ ] Create GitHub Release with binaries + checksums
- [ ] Update Homebrew formula (`packaging/homebrew/mmt-testlight.rb`) with new version + SHA-256, push to tap repo
- [ ] Update website Downloads page if any URLs/versions changed
- [ ] Verify all channels:
  ```bash
  npm view mmt-testlight version
  docker run --rm mshobeyri/mmt-testlight --version
  brew upgrade mmt-testlight && testlight --version
  curl -fsSL .../install-testlight.sh | bash && testlight --version
  ```

### For VS Code extension release (vX.Y.Z):

- [ ] Update root `package.json` version to `X.Y.Z`
- [ ] Update `CHANGELOG.md`
- [ ] Run: `npm run compile`
- [ ] Package: `vsce package` (or `vsce package --pre-release`)
- [ ] Publish: `vsce publish` (or `vsce publish --pre-release`)
- [ ] Verify on Marketplace

---

## Key Files Reference

| File | Purpose |
|---|---|
| `Dockerfile` | Docker image build definition |
| `.dockerignore` | Excludes host artifacts from Docker build context |
| `.vscodeignore` | Excludes dev files from `.vsix` package |
| `.github/workflows/release-testlight.yml` | CI pipeline for full CLI release |
| `scripts/release-testlight.sh` | Local full release script |
| `scripts/build-binaries.sh` | Build platform binaries via `pkg` |
| `scripts/install-testlight.sh` | One-line installer for end users |
| `scripts/update-dockerhub-readme.sh` | Push README to Docker Hub via API |
| `packaging/homebrew/mmt-testlight.rb` | Homebrew formula |
| `packaging/docker/README.md` | Docker Hub repository overview |
| `bin/github-action/action.yml` | GitHub Action definition |
| `mmtcli/esbuild.js` | CLI esbuild bundler config |
| `mmtcli/package.json` | CLI npm package (version source of truth) |
| `package.json` (root) | Extension version + workspace scripts |
