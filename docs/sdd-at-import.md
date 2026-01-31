# SDD: `+/` Project Root Import Path Resolution

## Overview

Add support for `+/xxx.mmt` import syntax that resolves paths relative to where `multimeter.mmt` is located. The system walks up from the current file to find the project root, detects it per run, and throws an error if not found.

**Note:** The `+/` prefix was chosen because `@` is a reserved character in YAML and `//` can cause issues in some contexts.

## Motivation

When working with larger projects with nested folder structures, relative imports like `../../../apis/common.mmt` become unwieldy. The `+/` prefix provides a consistent way to reference files from the project root, similar to how TypeScript path aliases work.

## Design

### Syntax

```yaml
type: test
import:
  api: +/apis/myApi.mmt        # Resolves from project root
  helper: ./helpers/util.mmt   # Resolves relative to current file
```

### Project Root Definition

The **project root** is the directory containing `multimeter.mmt` (a file with `type: env`). The system walks up the directory tree from the current file until it finds this marker file.

### Resolution Rules

1. **`+/` prefix**: Strip prefix, resolve against project root directory
2. **Relative paths** (`./`, `../`): Resolve against current file's directory (existing behavior)
3. **Absolute paths** (`/path/to/file`): Use as-is (existing behavior)

### Error Handling

If `+/` is used but `multimeter.mmt` is not found in any parent directory:
- Throw error: `"multimeter.mmt not found"`

## Implementation

### Files Modified

| File | Changes |
|------|---------|
| `core/src/fileHelper.ts` | Add `findProjectRoot()`, `isProjectRootImport()`, `resolveProjectRootImport()`, extend `resolveRequestedAgainst()` |
| `core/src/fileImporter.ts` | Add `projectRoot` to config, pass to resolution |
| `core/src/JSerImports.ts` | Accept and pass `projectRoot` parameter |
| `core/src/JSerTest.ts` | Pass `projectRoot` to imports |
| `core/src/JSerAPI.ts` | Pass `projectRoot` to imports |
| `core/src/runner.ts` | Add `projectRoot` to options, auto-detect if not provided |
| `mmtcli/src/cli.ts` | Detect project root before running |
| `src/mmtAPI/run.ts` | Detect project root from document path |
| `docs/test-mmt.md` | Document `+/` import syntax |
| `docs/environment-mmt.md` | Note that `multimeter.mmt` serves as project root marker |

### Flow

```
1. User runs test.mmt with import: api: +/apis/foo.mmt

2. runner.runFile() called
   ├─ If projectRoot not provided:
   │    └─ findProjectRoot(filePath, fileLoader) walks up to find multimeter.mmt
   └─ Passes projectRoot to generateTestJs()

3. generateTestJs() → importsToJsfunc()
   └─ createFileImporter({ projectRoot, ... })

4. fileImporter.resolveAll(imports)
   └─ For "+/apis/foo.mmt":
        └─ resolveRequestedAgainst(basePath, "+/apis/foo.mmt", projectRoot)
             ├─ isProjectRootImport("+/apis/foo.mmt") → true
             └─ resolveProjectRootImport("+/apis/foo.mmt", projectRoot)
                  → "/project/root/apis/foo.mmt"

5. fileLoader loads resolved path, continues with nested imports
```

### API Changes

#### `core/src/fileHelper.ts`

```typescript
// New functions
export async function findProjectRoot(
  startPath: string,
  fileExists: (path: string) => Promise<boolean>
): Promise<string | null>;

export function isProjectRootImport(path: string): boolean;

export function resolveProjectRootImport(importPath: string, projectRoot: string): string;

// Extended signature
export function resolveRequestedAgainst(
  baseFilePath: string | undefined,
  requested: string,
  projectRoot?: string  // NEW optional parameter
): string;
```

#### `core/src/fileImporter.ts`

```typescript
interface FileImporterConfig {
  fileLoader: FileLoader;
  rootPath: string;
  projectRoot?: string;  // NEW
  getImports: (content: string) => Record<string, string> | undefined;
}
```

#### `core/src/runner.ts`

```typescript
interface RunFileOptions {
  // ... existing fields
  projectRoot?: string;  // NEW - if not provided, auto-detected
}
```

## Testing

1. Test `@/` import resolves correctly when `multimeter.mmt` exists
2. Test error is thrown when `@/` used but `multimeter.mmt` not found
3. Test nested imports: file imported via `@/` can use relative imports
4. Test nested `@/`: file imported via `@/` can also use `@/` imports
5. Test CLI and VS Code both resolve `@/` consistently

## Documentation Updates

### docs/test-mmt.md

Add section:
```markdown
## Project Root Imports (@/)

Use `@/` prefix to import files relative to the project root (where `multimeter.mmt` is located):

\`\`\`yaml
import:
  api: @/apis/userApi.mmt
  helpers: @/shared/testHelpers.mmt
\`\`\`

This is useful for avoiding long relative paths like `../../../apis/userApi.mmt`.

**Note**: Requires a `multimeter.mmt` file (with `type: env`) in your project root.
```

### docs/environment-mmt.md

Add note:
```markdown
## Project Root Marker

The `multimeter.mmt` file also serves as the project root marker for `@/` imports. 
When you use `@/path/to/file.mmt` in imports, the path resolves relative to the 
directory containing `multimeter.mmt`.
```
