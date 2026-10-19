# CountryInfo SOAP — Multimeter vs SoapUI

[Multimeter](https://mmt.dev) / `testlight` suites for the public [CountryInfo](http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso) SOAP service live in [`multimeter/`](./multimeter/) (see that folder’s [README](./multimeter/README.md) for run, coverage, env, and layout).

This root README is the **SoapUI migration story**: same WSDL SoapUI tutorials use, as YAML-in-git tests you can review, diff, and run in CI with one command.

## Why Multimeter (vs SoapUI)

SoapUI projects are typically one large XML project file (or ReadyAPI proprietary). Multimeter keeps each SOAP operation and each case as small `.mmt` files — parallel suites by default, field-level expects on XML paths, and `testlight` for CI without a desktop UI.

| | Multimeter | SoapUI Open Source |
|---|---|---|
| Project shape | Many small YAML `.mmt` files | One (or few) SoapUI project XML files |
| Assertions | Named outputs + operators (`report: all`) | Assertions / scripts per step |
| Suite execution | Parallel by default | Sequential unless scripted |
| CI | `npx testlight run suite.mmt --env-file multimeter.mmt` | Maven plugin / TestRunner / Groovy |
| AI / review | Open one area folder | Load a large project XML |

### Same SOAP surface

This sample covers the operations people usually try first in SoapUI against CountryInfo:

- Lookup: `CountryName`, `CountryISOCode`, `CapitalCity`
- Details: `FullCountryInfo`, `CountryFlag`, `CountryIntPhoneCode`, `CountryCurrency`
- Currency: `CurrencyName`, `CountriesUsingCurrency`
- Lists: continents + country names by code

Each API file is a real SOAP 1.1 envelope (`format: xml`) with `SOAPAction: ""`, posting to the public WSDL endpoint. Outputs use Multimeter XML paths into the namespaced response (`body.soap:Envelope.soap:Body.m:…`).

### CI

```sh
# Multimeter — one command, project env, exit code from the suite
npx testlight run multimeter/suite.mmt --env-file multimeter/multimeter.mmt
```

Day-to-day CountryInfo work: [`multimeter/README.md`](./multimeter/README.md).

## License

MIT
