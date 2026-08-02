# Control flow

## if, else
Conditionally run nested steps based on an expression. The true branch is `steps:`; an optional `else:` runs when the condition is false. There is no `elseif` — nest another `if` inside `else` when you need more branches.

Combine two (or more) comparisons with `&&` (and) or `||` (or). `&&` binds tighter than `||`. Surround `&&` / `||` with spaces.

```yaml
- if: ${doLogin.status} == 200
  steps:
    - call: getUser
      id: me
  else:
    - print: "Login failed"
    - if: ${doLogin.status} == 401
      steps:
        - print: "Unauthorized"
      else:
        - print: "Other error"

# AND / OR
- if: ${doLogin.status} == 200 && ${doLogin.body.ok} == true
  steps:
    - print: "Login succeeded"
- if: ${doLogin.status} == 401 || ${doLogin.status} == 403
  steps:
    - print: "Not allowed"
```

## for, repeat
`for` runs with a JavaScript-style header (for example, `const user of users`) and executes the inner steps per item. `repeat` runs the inner steps a fixed number of times, time-based, or indefinitely.

The `for` expression is passed directly to JavaScript, so any valid JS for-of/for-in/for header works:
```yaml
# iterate imported CSV rows (from import:
#   users: ./users.csv)
- for: const user of users
  steps:
    - call: login
      id: login1
      inputs:
        username: ${user.username}
        password: ${user.password}

# iterate with index
- for: let i = 0; i < 10; i++
  steps:
    - print: "iteration ${i}"

# iterate object entries
- for: const [key, value] of Object.entries(config)
  steps:
    - print: "${key} = ${value}"
```

`repeat` supports count-based, time-based, and infinite modes:
```yaml
# repeat N times
- repeat: 3
  steps:
    - call: poll
    - delay: 2s

# repeat for a duration
- repeat: 30s
  steps:
    - call: healthCheck

# other time units: ns, ms, s, m, h
- repeat: 5m
  steps:
    - call: poll

# combined durations
- repeat: 1h5m
  steps:
    - call: poll
- repeat: 5m3s
  steps:
    - call: poll

# repeat indefinitely (until manually stopped)
- repeat: inf
  steps:
    - call: monitor
    - delay: 1s
```

## delay
Pause the flow for a duration.
```yaml
- delay: 500    # ms
- delay: 2s     # units: ns|ms|s|m|h
- delay: 1h5m   # combined duration
- delay: 5m3s   # combined duration
```
