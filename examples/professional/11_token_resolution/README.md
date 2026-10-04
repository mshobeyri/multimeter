# Token resolution

Professional samples of `e:`, `i:`, `r:`, and `c:` against [test.mmt.dev/echo](https://test.mmt.dev/echo).

A whole field in a **JSON** body keeps the value's type. **XML**, **urlencoded**, **headers**, and **query** always send text. A quoted token such as `"e:account_age"` is the literal text. `omit` removes the field. `"omit"` sends the word omit. A missing `e:`, `i:`, `r:`, or `c:` token is sent as its own text, for example `e:region` or `i:nickname`.

Each request also sends the other spellings of one token:

| YAML | Meaning |
|---|---|
| `<<e:account_age>>` | Whole value. JSON keeps the type (`42`). Other formats send the text `42`. |
| `"<<e:account_age>>"` | Quoted whole angle. Sent as the text `<<e:account_age>>`. |
| `"asda<<e:account_age>>"` | Text before the token. Sent as `asda42`. |
| `"<<e:account_age>>asas"` | Text after the token. Sent as `42asas`. |
| `"asda<<e:feature_enabled>>asas"` | Text on both sides. Sent as `asdatrueasas`. |
| `{{e:plan_label}}` | Unquoted curly, same as a bare token. JSON keeps the string `"10"`. |
| `"{{e:account_age}}"` | Quoted curly. Sent as the text `{{e:account_age}}`. |
| `<<e:service_url[0:8]>>` | Part of a string. Sent as `https://`. |
| `"x<<e:region>>y"` | A missing name inside text. Sent as `xe:regiony`. |

`"asda<<token>>"` and `"<<token>>asas"` are strings in every format. `<<i:age>>`, `<<r:int(10,20)>>`, and `<<c:epoch>>` follow the same whole-value rule as `e:`. Unquoted `{{token}}` resolves the same way as `<<token>>` for `e:`, `i:`, `r:`, `c:`, and `o:`.

A quoted `"<<token>>"` or `"{{token}}"` is that text in every format. XML escapes `<` and `>`, so `"<<e:account_age>>"` is echoed as `&lt;&lt;e:account_age&gt;&gt;`. `"{{e:account_age}}"` is echoed as `{{e:account_age}}`. The same rule applies to `i:`, `r:`, and `c:`.

## Environment

`multimeter.mmt` is loaded as the workspace environment. The active values are:

| Name | Type | Value |
|---|---|---|
| `service_url` | string | `https://test.mmt.dev` |
| `account_age` | number | `42` |
| `feature_enabled` | boolean | `true` |
| `plan_code` | number | `10` |
| `plan_label` | string | `"10"` |

JSON is the only format here that still shows `plan_code` as the number `10` and `plan_label` as the string `"10"`.

## Files

| File | What is echoed |
|---|---|
| `api/env_json_body.mmt` | `e:` in JSON, types kept |
| `api/env_xml_body.mmt` | `e:` as XML text |
| `api/env_urlencoded_body.mmt` | `e:` as form text |
| `api/env_header.mmt` | `e:` as header text |
| `api/env_query.mmt` | `e:` as query text |
| `api/input_json_body.mmt` | `i:` in JSON, types kept (`age` is `100`, `active` is `true`) |
| `api/input_xml_body.mmt` | `i:` as XML text |
| `api/input_urlencoded_body.mmt` | `i:` as form text |
| `api/input_header.mmt` | `i:` as header text |
| `api/input_query.mmt` | `i:` as query text |
| `api/random_json_body.mmt` | `r:uuid` text, `r:int` number, `r:bool` boolean |
| `api/random_xml_body.mmt` | `r:` as XML text |
| `api/random_urlencoded_body.mmt` | `r:` as form text |
| `api/random_header.mmt` | `r:` as header text (`r:color` stays a name) |
| `api/random_query.mmt` | `r:` as query text |
| `api/current_json_body.mmt` | `c:day` and `c:city` text, `c:epoch` number |
| `api/current_xml_body.mmt` | `c:` as XML text |
| `api/current_urlencoded_body.mmt` | `c:` as form text |
| `api/current_header.mmt` | `c:` as header text |
| `api/current_query.mmt` | `c:` as query text |

Each API lists `outputs` for the echoed fields and a no-input `examples` entry (`id: defaults`) with the same `expect` checks as its matching test, so you can validate outputs from the API tester. Matching tests live under `test/` (`env_json_body_test.mmt` for `api/env_json_body.mmt`, and so on). `suite.mmt` runs all twenty.

## How to use

Open any file in `api/` and click **Send**, or run the `defaults` example glyph to check outputs. Open a file in `test/`, or `suite.mmt`, and click **Run**.

```sh
npx testlight run examples/professional/11_token_resolution/test/env_json_body_test.mmt \
  --env-file examples/professional/11_token_resolution/multimeter.mmt
npx testlight run examples/professional/11_token_resolution/test/input_json_body_test.mmt
npx testlight run examples/professional/11_token_resolution/suite.mmt \
  --env-file examples/professional/11_token_resolution/multimeter.mmt
```
