# ──────────────────────────────────────────────────────────────────────
# Dockerfile — testlight CLI
# ──────────────────────────────────────────────────────────────────────
# Build:
#   docker build -t mshobeyri/mmt-testlight .
#
# Run:
#   docker run --rm -v "$PWD:/workspace" -w /workspace mshobeyri/mmt-testlight run test.mmt
#   docker run --rm -v "$PWD:/workspace" -w /workspace mshobeyri/mmt-testlight doc api.mmt
#
# Both `testlight` and `mmt` commands are available:
#   docker run --rm mshobeyri/mmt-testlight --version
#   docker run --rm --entrypoint mmt mshobeyri/mmt-testlight --version
# ──────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ───────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /build

# Copy package files first (layer caching)
COPY package.json package-lock.json ./
COPY core/package.json core/
COPY mmtcli/package.json mmtcli/package-lock.json mmtcli/

# Install root workspace deps + mmtcli deps (mmtcli is not a workspace)
RUN npm ci 2>/dev/null || npm install
RUN npm ci --prefix mmtcli

# Copy source
COPY core/ core/
COPY mmtcli/ mmtcli/
COPY res/doc-template.html res/doc-template.html

# Build core and CLI
RUN cd core && npm run build
RUN npm rebuild esbuild && cd mmtcli && npm run build

# ── Stage 2: Runtime ─────────────────────────────────────────────────
FROM node:18-alpine

LABEL org.opencontainers.image.title="testlight"
LABEL org.opencontainers.image.description="Multimeter CLI — run .mmt API tests, test suites, and generate docs"
LABEL org.opencontainers.image.source="https://github.com/mshobeyri/multimeter"

WORKDIR /app

# Copy built artefacts
COPY --from=builder /build/core/dist/ core/dist/
COPY --from=builder /build/core/package.json core/
COPY --from=builder /build/mmtcli/dist/ mmtcli/dist/
COPY --from=builder /build/mmtcli/package.json mmtcli/
COPY --from=builder /build/mmtcli/package-lock.json mmtcli/

# Copy root package.json for workspace resolution
COPY package.json ./

# Install production dependencies only (externals left out of the esbuild bundle)
RUN cd mmtcli && npm ci --omit=dev --ignore-scripts

# Create symlinks in /usr/local/bin
RUN ln -s /app/mmtcli/dist/cli.js /usr/local/bin/testlight && \
    chmod +x /app/mmtcli/dist/cli.js && \
    ln -s /usr/local/bin/testlight /usr/local/bin/mmt

# Ensure the entrypoint has a shebang
RUN head -1 /app/mmtcli/dist/cli.js | grep -q '^#!' || \
    sed -i '1i#!/usr/bin/env node' /app/mmtcli/dist/cli.js

ENTRYPOINT ["testlight"]
CMD ["--help"]
