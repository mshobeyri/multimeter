# SDD: Mock Server Integration in Tests and Suites

**Date:** 2026-03-08
**Status:** Draft — awaiting review

---

## Summary

Extend Multimeter to allow starting mock servers (`type: server`) from within tests (via a new `run` step) and suites (by including server files in the `tests` array). Also add an **MMT Mock Server** option in the Mock Server panel to run a `.mmt` server file directly with full routing capability.

---

## Motivation

Currently, users must manually start mock servers from the Mock Server panel before running tests. This creates friction:

- Tests can't be self-contained — they depend on external setup
- CI runs require separate server provisioning
- No way to declaratively specify which mock server a test needs

By integrating mock servers into the test/suite execution flow:

- Tests become fully self-contained and portable
- CI pipelines (`testlight`) can run tests without manual setup
- The server panel gains the power of `.mmt` server files (routing, matching, tokens)

---

## Design

### 1. Test: New `run` Step Type

Add a `run` step that starts an imported server. The server runs for the duration of the test and stops automatically when the test completes.

```yaml
type: test
title: API Test with Mock Server
import:
  mockApi: ./mocks/user-service.mmt   # type: server file
  userApi: ./apis/user.mmt
steps:
  - run: mockApi                       # starts the mock server
  - call: userApi
    id: getUsers
  - assert: getUsers.status == 200
```

#### Behavior

| Scenario | Behavior |
|----------|----------|
| Server not running | Start the server on configured port |
| Server already running (same file) | No-op (idempotent) |
| Port conflict | Fail with error |
| Test ends | All servers started by `run` are stopped |

#### Data Model

Add to `TestData.ts`:

```typescript
export interface TestFlowRun extends TestFlowBase {
  run: string;  // alias of an imported server file
}

export type TestFlowStep = /* existing types */ | TestFlowRun;
```

Update `flowTypeOptions` and `addableFlowTypes` to include `'run'`.

### 2. Suite: Server Files in `tests` Array

Suites can include `type: server` files in the `tests` array. Servers are started before tests in the same stage and stopped when the suite completes.

```yaml
type: suite
title: Integration Suite
tests:
  - mocks/user-service.mmt    # type: server — started first
  - mocks/auth-service.mmt    # type: server — started in parallel
  - then
  - tests/login.mmt           # tests run after servers are ready
  - tests/profile.mmt
```

#### Execution Order

1. All items before the first `then` start in parallel
2. Server files are started; tests wait for servers to be ready
3. Tests execute against running servers
4. When suite completes (or on error), all servers are stopped

#### Bundle Node Type

Add `'server'` to the bundle node kind in `suiteBundle.ts`:

```typescript
export type SuiteBundleNodeKind = 'test' | 'api' | 'suite' | 'server' | 'missing' | 'cycle';
```

### 3. Mock Server Panel: MMT Mock Server Option

Add a fourth server type option in the panel: **MMT Mock Server**.

#### UI Changes

When "MMT Mock Server" is selected:
- **Hide**: Status code, Response textarea, Reflect checkbox, CORS checkbox, HTTPS certificate fields
- **Show**: File chooser with a text input + folder button to select a `.mmt` server file
- **Run button**: Starts the selected server file using the full mock router

```
┌─────────────────────────────────────┐
│ Server Type: [MMT Mock Server ▼]    │
├─────────────────────────────────────┤
│ Server File                         │
│ [mocks/user-service.mmt] [📁]       │
├─────────────────────────────────────┤
│ Port: [8081]                        │
├─────────────────────────────────────┤
│ [▶ Run Mock Server]                 │
└─────────────────────────────────────┘
```

#### Behavior

- File is parsed using `mockParsePack.parseMockData`
- Server starts using `mockRunner.startMockServer` (same as editor panel for `.mmt` server files)
- Port from the panel overrides the file's `port` if specified (or uses file default)
- Errors (parse, port conflict) shown via `vscode.window.showErrorMessage`

### 4. ServerType Extension

Update `ServerType` in `MockServerPanel.ts`:

```typescript
type ServerType = 'http' | 'https' | 'ws' | 'mmt';
```

### 5. Test UI: Add Server Box

In the Flow panel (`TestFlow.tsx`), add `'run'` to `addableFlowTypes`. The UI renders a box with:

- Icon: `codicon-server` 
- Label: "Server"
- Content: Dropdown of imported server files (filtered from `testData.import`)

```tsx
case 'run':
  return 'codicon-server';
```

#### TestFlowBox Rendering

Add a case in `TestFlowBox.tsx` for `run`:

```tsx
case 'run':
  return (
    <div className="flow-box run">
      <label>Server</label>
      <select value={step.run} onChange={...}>
        {serverImports.map(alias => (
          <option key={alias} value={alias}>{alias}</option>
        ))}
      </select>
    </div>
  );
```

---

## Implementation Plan

### Phase 1: Core + Test Step

1. **TestData.ts**: Add `TestFlowRun` interface
2. **testParsePack.ts**: Parse `run` steps
3. **testHelper.ts**: Execute `run` steps (start server, track for cleanup)
4. **runTest.ts**: Add cleanup hook to stop servers on test end

### Phase 2: Suite Support

1. **suiteBundle.ts**: Recognize `type: server` files in hierarchy
2. **executeSuiteBundle**: Start servers before tests in same stage
3. **Reporter**: Emit `scope: 'suite-item'` updates for server start/stop

### Phase 3: Test UI

1. **TestFlow.tsx**: Add `'run'` to `addableFlowTypes`
2. **TestFlowBox.tsx**: Add rendering for `run` step with server alias selector
3. **codiconForType**: Add `'run'` → `'codicon-server'`

### Phase 4: Mock Server Panel

1. **MockServerPanel.ts**: Add `'mmt'` to `ServerType`
2. **mockServer.html**: Add MMT section with file chooser
3. **handleMessage**: Handle `pickMmtServerFile` and `setMmtServerFile`
4. **startServer**: Branch for `mmt` type to use `mockRunner`

---

## File Changes Summary

| File | Change |
|------|--------|
| `core/src/TestData.ts` | Add `TestFlowRun`, update `FlowType` |
| `core/src/testParsePack.ts` | Parse `run` steps |
| `core/src/testHelper.ts` | Execute `run` steps, server lifecycle |
| `core/src/runTest.ts` | Cleanup hook for servers |
| `core/src/SuiteData.ts` | (No change — uses existing `tests` array) |
| `core/src/suiteBundle.ts` | Add `'server'` node kind |
| `src/mmtAPI/suiteRunner.ts` | Handle server nodes in execution |
| `src/panels/MockServerPanel.ts` | Add `'mmt'` type, file chooser |
| `res/mockServer.html` | Add MMT section UI |
| `mmtview/src/test/TestFlow.tsx` | Add `'run'` to addable types |
| `mmtview/src/test/TestFlowBox.tsx` | Render `run` step |
| `docs/mock-server.md` | Document new features |
| `docs/test-mmt.md` | Document `run` step |
| `docs/suite-mmt.md` | Document servers in suites |
| `docs/AI/generate-test.md` | Add `run` step to schema |

---

## Error Handling

| Error | Handling |
|-------|----------|
| Import not found | Validation error at parse time |
| Import is not a server file | Runtime error: "Expected type: server" |
| Port already in use | Runtime error with port number |
| Server fails to start | Test fails with server error message |

---

## Testing Strategy

### Unit Tests

- `testParsePack.test.ts`: Parse `run` steps correctly
- `suiteBundle.test.ts`: Server nodes in hierarchy

### Integration Tests

- Test file with `run` step starts/stops server
- Suite with server file starts before tests
- Idempotent start (second `run` of same server is no-op)
- Port conflict detection

---

## Open Questions

1. **Multiple servers**: Should `run` allow running multiple servers? (Current: yes, each `run` step starts one)
2. **Port override**: Should the `run` step allow overriding the port? (Current: no, use file's port)
3. **Health check**: Should we wait for the server to be "ready" before proceeding? (Current: proceed immediately after bind)

---

## See Also

- [sdd-mock-file-type.md](./sdd-mock-file-type.md) — original mock file type design
- [mock-server.md](../docs/mock-server.md) — user documentation
- [test-mmt.md](../docs/test-mmt.md) — test file documentation
