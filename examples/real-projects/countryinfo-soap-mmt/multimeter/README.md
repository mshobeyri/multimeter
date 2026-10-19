# CountryInfo SOAP Multimeter project

Executable [Multimeter](https://mmt.dev) / `testlight` suites for the public [CountryInfo](http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso) SOAP web service — the same WSDL SoapUI tutorials often use.

No API key. No account. HTTP endpoint only (the host does not serve TLS).

For Multimeter vs SoapUI positioning, see the [repo README](../README.md).

## Run

From this folder:

```sh
npx testlight run suite.mmt --env-file multimeter.mmt
```

From the parent folder (`countryinfo-soap-mmt/`):

```sh
npx testlight run multimeter/suite.mmt --env-file multimeter/multimeter.mmt
```

Or open `multimeter.mmt` in the Multimeter extension (project root marker), then open `suite.mmt` and Run.

One area only:

```sh
npx testlight run test/lookup/suite.mmt --env-file multimeter.mmt
```

## What’s covered

Each area folder under `test/` has its own `suite.mmt` that runs every `test_*.mmt` beside it. Root `suite.mmt` calls those area suites.

| Area suite | SOAP operations |
|---|---|
| `test/lookup/suite.mmt` | CountryName, CountryISOCode, CapitalCity, name↔ISO round-trip |
| `test/details/suite.mmt` | FullCountryInfo, CountryFlag, CountryIntPhoneCode, CountryCurrency |
| `test/currency/suite.mmt` | CurrencyName, CountriesUsingCurrency |
| `test/continents/suite.mmt` | ListOfContinentsByName, ListOfContinentsByCode |
| `test/lists/suite.mmt` | ListOfCountryNamesByCode |

Tests pass catalog values from `countries.json` and assert exact field expects (`report: all`) — not only HTTP 200.

## Environment

Edit `multimeter.mmt` (or pass `-e` / `--env-file` overrides):

| Variables | Use |
|---|---|
| `soap_url` | CountryInfo SOAP endpoint |
| `country` | Choice map for **API Send defaults** (`iso` / `name`). Tests use `countries.json`, not `e:country`. |
| `currency` | Choice map for currency API Send defaults |

**Where values live:**

| Place | In this project |
|---|---|
| **Env** | `soap_url`, `country`, `currency` for interactive Send |
| **JSON** | `countries.json` — fixed country catalog |
| **Direct in the test** | Currency codes for list filters (`EUR`, `USD`) |

## Layout

```
multimeter.mmt          # project root marker + env
countries.json          # ISO / name / capital / currency catalog
suite.mmt               # root — calls each test/<area>/suite.mmt
api/                    # one SOAP operation per file (XML envelope)
test/<area>/
  suite.mmt
  test_*.mmt
```

## Upstream

- Service: http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso  
- WSDL: http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso?WSDL  

Public demo hosted by [oorsprong.org](http://www.oorsprong.org/) (DataFlex sample). Treat it as a live shared service — keep suites small and avoid hammering list-all operations in tight loops.
