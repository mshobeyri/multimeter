# Sample Project: Pet Store API

A complete walkthrough of Multimeter features using a fictional Pet Store API. Follow along to build a real project with APIs, tests, docs, suites, environments, and CLI usage.

---

## Project structure

```
petstore/
├── multimeter.mmt              # project root marker + environment
├── apis/
│   ├── auth/
│   │   └── login.mmt           # POST /auth/login
│   ├── pets/
│   │   ├── create_pet.mmt      # POST /pets
│   │   ├── get_pet.mmt         # GET  /pets/:id
│   │   └── list_pets.mmt       # GET  /pets
│   └── orders/
│       └── place_order.mmt     # POST /orders
├── tests/
│   ├── data/
│   │   └── pets.csv            # test data for data-driven loops
│   ├── helpers/
│   │   └── utils.js            # JS helper module
│   ├── login_test.mmt          # basic login test
│   ├── pet_crud_test.mmt       # create → get → verify flow
│   └── order_flow_test.mmt     # login → create pet → place order
├── suites/
│   ├── smoke.mmt               # quick smoke suite
│   └── full_regression.mmt     # full regression with stages
└── docs/
    └── catalog.mmt             # API documentation site
```

---

## 1. Environment — `multimeter.mmt`

This file at the project root serves two purposes: it defines shared environment variables/presets, and it marks the project root for `+/` imports.

```yaml
type: env
variables:
  api_url:
    local: http://localhost:3000
    staging: https://staging.petstore.io
    production: https://api.petstore.io
  admin_user: admin@petstore.io
  admin_pass: secret123
  default_limit: 20

presets:
  runner:
    dev:
      api_url: local
      default_limit: 5
    staging:
      api_url: staging
    prod:
      api_url: production
```

What you get:
- `e:api_url` resolves to the selected URL everywhere
- `presets.runner.dev` switches all variables at once — one flag in the UI or CLI
- `+/` imports in any file resolve relative to this directory

---

## 2. APIs

### `apis/auth/login.mmt` — Login

```yaml
type: api
title: Login
description: |
  Authenticate a user and receive a JWT token.

  <<i:email>> User email address
  <<i:password>> User password

  <<o:token>> JWT access token (valid for 1 hour)
  <<o:userId>> Authenticated user ID
tags:
  - auth
  - smoke
inputs:
  email: e:admin_user
  password: e:admin_pass
outputs:
  token: body[token]
  userId: body[user][id]
setenv:
  token: token
method: post
format: json
url: <<e:api_url>>/auth/login
body:
  email: i:email
  password: i:password
examples:
  - name: admin-login
    description: Login with admin credentials
    inputs:
      email: admin@petstore.io
      password: secret123
    outputs:
      token: "*"
  - name: bad-password
    description: Login with wrong password
    inputs:
      email: admin@petstore.io
      password: wrong
    outputs:
      status: 401
```

Features shown:
- **Inputs/outputs** for reuse from tests
- **`setenv`** promotes the token into the environment for subsequent calls
- **`<<i:…>>`** and **`e:VAR`** tokens in URL and body
- **Parameter annotations** (`<<i:…>>`, `<<o:…>>`) in description for docs
- **Examples** as runnable smoke tests with expected outputs

### `apis/pets/create_pet.mmt` — Create a pet

```yaml
type: api
title: Create Pet
description: |
  Add a new pet to the store.

  <<i:name>> Pet name
  <<i:species>> Species (dog, cat, bird, fish)
  <<i:price>> Price in USD

  <<o:id>> Created pet ID
  <<o:createdAt>> ISO 8601 creation timestamp
tags:
  - pets
  - crud
inputs:
  name: Buddy
  species: dog
  price: 29.99
outputs:
  id: body[id]
  createdAt: body[createdAt]
method: post
format: json
url: <<e:api_url>>/pets
headers:
  Authorization: Bearer <<e:token>>
  name: i:name
  species: i:species
  price: i:price
  sku: r:uuid
```

Features shown:
- **`r:uuid`** generates a random UUID for each request
- **Bearer token from environment** via `<<e:token>>` (set by login's `setenv`)

### `apis/pets/get_pet.mmt` — Get a pet by ID

```yaml
type: api
title: Get Pet
description: |
  Retrieve a pet by its ID.

  <<i:petId>> The pet's unique identifier

  <<o:name>> Pet name
  <<o:species>> Pet species
  <<o:price>> Pet price
tags:
  - pets
inputs:
  petId: "1"
outputs:
  name: body[name]
  species: body[species]
  price: body[price]
method: get
format: json
url: <<e:api_url>>/pets/<<i:petId>>
headers:
  Authorization: Bearer <<e:token>>
```

### `apis/pets/list_pets.mmt` — List pets

```yaml
type: api
title: List Pets
description: |
  List all pets with optional filtering.

  <<o:total>> Total number of pets matching the query
tags:
  - pets
outputs:
  total: body[total]
  firstId: body[items][0][id]
method: get
format: json
url: <<e:api_url>>/pets
headers:
  Authorization: Bearer <<e:token>>
query:
  limit: e:default_limit
  sort: name
```

Features shown:
- **Query parameters** as a map (merged into the URL)
- **Environment variable in query** (`e:default_limit` preserves its number type)
- **Deep output extraction** with bracket path (`body[items][0][id]`)

### `apis/orders/place_order.mmt` — Place an order

```yaml
type: api
title: Place Order
description: |
  Place an order for a pet.

  <<i:petId>> ID of the pet to order
  <<i:quantity>> Number of items

  <<o:orderId>> Created order ID
  <<o:status>> Order status (placed, approved, delivered)
tags:
  - orders
inputs:
  petId: "1"
  quantity: 1
outputs:
  orderId: body[id]
  status: body[status]
method: post
format: json
url: <<e:api_url>>/orders
headers:
  Authorization: Bearer <<e:token>>
  X-Request-Id: r:uuid
body:
  petId: i:petId
  quantity: i:quantity
  shipDate: c:date
```

Features shown:
- **`c:date`** inserts the current date
- **`r:uuid`** in a header for request tracing

---

## 3. Tests

### `tests/data/pets.csv` — Test data

```csv
name,species,price
Buddy,dog,29.99
Whiskers,cat,19.99
Tweety,bird,14.99
```

### `tests/helpers/utils.js` — JS helper module

```js
module.exports = {
  formatPrice(amount) {
    return `$${Number(amount).toFixed(2)}`;
  },
  isValidUUID(str) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
  }
};
```

### `tests/login_test.mmt` — Basic login test

```yaml
type: test
title: Login Test
tags:
  - smoke
  - auth
import:
  login: +/apis/auth/login.mmt
inputs:
  email: e:admin_user
  password: e:admin_pass
steps:
  - call: login
    id: doLogin
    inputs:
      email: i:email
      password: i:password
  - assert: doLogin.status == 200
  - check: doLogin.token != null
  - print: "Logged in, token starts with ${doLogin.token.substring(0, 10)}…"
```

Features shown:
- **`+/` project root import** — works regardless of file depth
- **`assert`** stops the test on failure; **`check`** logs and continues
- **`print`** with template expression for debugging

### `tests/pet_crud_test.mmt` — Create and verify a pet

```yaml
type: test
title: Pet CRUD
description: Create a pet, then retrieve it and verify fields match.
tags:
  - pets
  - crud
import:
  login: +/apis/auth/login.mmt
  create: +/apis/pets/create_pet.mmt
  get: +/apis/pets/get_pet.mmt
  helpers: +/tests/helpers/utils.js
steps:
  # authenticate first
  - call: login
    id: auth

  - assert: auth.status == 200

  # create a pet
  - call: create
    id: newPet
    inputs:
      name: Rex
      species: dog
      price: 49.99

  - assert: newPet.status == 201

  # use JS helper to validate the ID format
  - js: |
      const valid = helpers.isValidUUID(newPet.id);
      report_('check', { actual: valid, expected: true, operator: '==' },
              'Pet ID is a valid UUID', '', valid);

  # retrieve the pet we just created
  - call: get
    id: fetched
    inputs:
      petId: newPet.id

  - assert: fetched.status == 200
  - check: fetched.name == "Rex"
  - check: fetched.species == "dog"
  - check: fetched.price == 49.99

  - print: "Created and verified pet ${newPet.id}"
```

Features shown:
- **JS helper import** — `utils.js` loaded via `import`, used in `js` step
- **`report_()`** global to emit check results from JavaScript
- **Chaining outputs** — `newPet.id` flows into the `get` call's input

### `tests/order_flow_test.mmt` — End-to-end order flow with stages

```yaml
type: test
title: Order Flow
description: |
  Full flow: login → create pet → place order → verify.
  Uses stages for parallel setup and sequential ordering.
tags:
  - e2e
  - orders
import:
  login: +/apis/auth/login.mmt
  create: +/apis/pets/create_pet.mmt
  order: +/apis/orders/place_order.mmt
  pets_csv: +/tests/data/pets.csv
stages:
  - id: auth
    title: Authenticate
    steps:
      - call: login
        id: doLogin
      - assert: doLogin.status == 200

  - id: create_pets
    title: Create Pets from CSV
    depends_on: auth
    steps:
      - data: pets_csv
      - for: const pet of pets_csv
        steps:
          - call: create
            id: created
            inputs:
              name: pet.name
              species: pet.species
              price: pet.price
          - check: created.status == 201

      - set:
          lastPetId: created.id

  - id: place_order
    title: Place Order
    depends_on: create_pets
    condition: created.status == 201
    steps:
      - call: order
        id: myOrder
        inputs:
          petId: lastPetId
          quantity: 2
      - assert: myOrder.status == 201
      - check: myOrder.status == "placed"

      - print: "Order ${myOrder.orderId} placed for pet ${lastPetId}"
```

Features shown:
- **Stages** with `depends_on` for sequential ordering
- **`condition`** to skip a stage if a previous step failed
- **CSV data import** and **`for` loop** for data-driven testing
- **`data`** step binds the CSV into scope
- **`set`** captures a value for use in a later stage

---

## 4. Documentation — `docs/catalog.mmt`

```yaml
type: doc
title: Pet Store API
description: |
  Complete API reference for the Pet Store service.
  Covers authentication, pet management, and order placement.
logo: https://petstore.io/logo.png
sources:
  - +/apis
services:
  - name: Authentication
    description: Login and token management
    sources:
      - +/apis/auth
  - name: Pets
    description: Pet CRUD operations
    sources:
      - +/apis/pets
  - name: Orders
    description: Order placement and tracking
    sources:
      - +/apis/orders
env:
  api_url: https://api.petstore.io
  token: your-token-here
html:
  triable: true
  cors_proxy: "https://corsproxy.io/?"
```

Features shown:
- **Services** group APIs by domain in the rendered HTML
- **`env`** replaces `e:api_url` placeholders in the rendered docs
- **`html.triable`** adds interactive "Try" buttons to every endpoint
- **`cors_proxy`** routes Try-It requests through a CORS proxy
- **`logo`** and **`description`** render in the HTML header

Generate docs from the CLI:
```sh
testlight doc docs/catalog.mmt --out ./public/catalog.html
testlight doc docs/catalog.mmt --md --out ./public/catalog.md
```

---

## 5. Suites

### `suites/smoke.mmt` — Quick smoke test

```yaml
type: suite
title: Smoke Tests
description: Fast checks — login and basic CRUD.
tags:
  - smoke
  - ci
tests:
  - +/tests/login_test.mmt
  - +/tests/pet_crud_test.mmt
```

All tests run in **parallel** by default. This suite finishes as fast as the slowest test.

### `suites/full_regression.mmt` — Full regression with sequential stages

```yaml
type: suite
title: Full Regression
description: |
  Runs auth first, then CRUD and order tests in parallel.
tags:
  - regression
  - nightly
tests:
  - +/tests/login_test.mmt
  - then
  - +/tests/pet_crud_test.mmt
  - +/tests/order_flow_test.mmt
```

Execution order:
1. `login_test.mmt` runs first (before `then`)
2. After it passes, `pet_crud_test.mmt` and `order_flow_test.mmt` run in **parallel**

Features shown:
- **`then`** separates sequential stages
- Tests within a stage run in parallel; stages run sequentially

---

## 6. Running from the CLI

### Run a single test
```sh
testlight run tests/login_test.mmt \
  --env-file multimeter.mmt \
  --preset dev
```

### Run with input and env overrides
```sh
testlight run tests/pet_crud_test.mmt \
  --env-file multimeter.mmt \
  --preset staging \
  -e TOKEN=my-jwt-token \
  -i email=test@petstore.io
```

### Run a specific example from an API
```sh
testlight run apis/auth/login.mmt --example admin-login
testlight run apis/auth/login.mmt --example '#2'
```

### Run a suite
```sh
testlight run suites/full_regression.mmt \
  --env-file multimeter.mmt \
  --preset dev
```

### Run with JSON output for CI
```sh
testlight run suites/smoke.mmt \
  --env-file multimeter.mmt \
  --preset dev \
  --out results.json \
  --quiet
```

### Inspect generated JS
```sh
testlight print-js tests/order_flow_test.mmt \
  --env-file multimeter.mmt \
  --preset dev
```

---

## 7. Load testing with metrics

Add `metrics` to any test to run it under load:

```yaml
type: test
title: Login Load Test
metrics:
  repeat: 500
  threads: 20
  rampup: 10s
  duration: 2m
import:
  login: +/apis/auth/login.mmt
steps:
  - call: login
    id: doLogin
    inputs:
      email: r:email
      password: r:uuid
  - assert: doLogin.status == 200
```

This runs 500 iterations across 20 concurrent threads, ramping up over 10 seconds, with a 2-minute time limit. Each iteration gets a random email and password via `r:email` and `r:uuid`.

---

## Feature summary

| Feature | Where it appears |
|---------|-----------------|
| Environment variables & presets | `multimeter.mmt` |
| `e:VAR` / `<<e:VAR>>` tokens | All API files |
| `r:` random tokens | `create_pet.mmt`, `place_order.mmt`, load test |
| `c:` current tokens | `place_order.mmt` |
| Inputs / outputs | All API files |
| `setenv` (promote to env) | `login.mmt` |
| Output extraction (`body[…]`) | All API files |
| Parameter annotations (`<<i:>>`, `<<o:>>`) | API descriptions |
| Examples | `login.mmt` |
| `assert` / `check` | All tests |
| `print` | All tests |
| `call` with chained outputs | All tests |
| `set` variables | `order_flow_test.mmt` |
| `js` step with helper module | `pet_crud_test.mmt` |
| `for` loop with CSV data | `order_flow_test.mmt` |
| `data` step | `order_flow_test.mmt` |
| Stages with `depends_on` | `order_flow_test.mmt` |
| Stage `condition` | `order_flow_test.mmt` |
| `delay` | — (use `- delay: 2s` in any step list) |
| `if` / `else` | — (use `- if: expr` with nested `steps`) |
| `repeat` | — (use `- repeat: 3` or `- repeat: 30s`) |
| Metrics (load testing) | Load test example |
| Doc with services | `catalog.mmt` |
| Try It (interactive docs) | `catalog.mmt` |
| Suite parallel execution | `smoke.mmt` |
| Suite sequential stages (`then`) | `full_regression.mmt` |
| `+/` project root imports | All tests and suites |
| CLI: `run`, `print-js`, `doc` | CLI examples |
| CLI: `--preset`, `--env-file`, `-e`, `-i` | CLI examples |
| CLI: `--example`, `--out`, `--quiet` | CLI examples |

---

## See also
- [API](./api-mmt.md) — full API reference
- [Test](./test-mmt.md) — all test step types
- [Environment](./environment-mmt.md) — variables, presets, certificates
- [Suite](./suite-mmt.md) — grouping and running tests
- [Doc](./doc-mmt.md) — generating API documentation
- [Testlight CLI](./testlight.md) — command line usage
