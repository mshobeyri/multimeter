# Control Flow

Demonstrates **if/else** branching, **repeat** (count and time-based), **delay**, and **for** loops in test flows.

## Structure

```
13_control_flow/
├── api/
│   └── echo.mmt                 # Simple echo API
├── if_else_test.mmt             # if/else conditional branching
├── repeat_delay_test.mmt        # repeat (count + time) and delay
├── for_loop_test.mmt            # for loop with index
└── README.md
```

## Files

| File | Description |
|---|---|
| `api/echo.mmt` | Echo API used by all tests |
| `if_else_test.mmt` | Calls the API, branches on status code with `if`/`else` |
| `repeat_delay_test.mmt` | Repeats a call 3 times, then repeats for 3 seconds, with `delay` pauses |
| `for_loop_test.mmt` | Loops 3 times with a counter using `for: let i = 0; i < 3; i++` |

## Key concepts

- **`if` / `else`** — run nested steps conditionally. Uses the same expression syntax as `assert`/`check`.
- **`repeat: N`** — run nested steps N times (count-based).
- **`repeat: 3s`** — run nested steps for a duration. Supported units: `ms`, `s`, `m`, `h`. Use `inf` for indefinite.
- **`delay: 500`** — pause in milliseconds. Also supports units: `- delay: 2s`.
- **`for`** — JavaScript-style loop header. Supports `for-of`, `for-in`, and classic `for` syntax.
- `${variable}` — template literals resolve variables inside strings.

## How to use

### In VS Code

1. Open any test file and click **Run**.
2. Watch the Log panel — `print` statements show progress through branches, loops, and repeats.

### With the CLI

```sh
npx testlight run examples/15_control_flow/if_else_test.mmt
npx testlight run examples/15_control_flow/repeat_delay_test.mmt
npx testlight run examples/15_control_flow/for_loop_test.mmt
```
