# Token resolution

Professional samples of `e:`, `i:`, `r:`, and `c:` against [test.mmt.dev/echo](https://test.mmt.dev/echo).

A whole field in a **JSON** body keeps the value's type. **XML**, **urlencoded**, **headers**, and **query** always send text. A quoted token such as `"e:account_age"` is the literal text. `omit` removes the field. `"omit"` sends the word omit. A missing `e:`, `r:`, or `c:` token is sent as its own text, for example `e:region`. A missing `i:` token is `{{i:nickname}}` in JSON and `i:nickname` in the other formats.

Each request also sends the other spellings of one token:

| YAML | Meaning |
|---|---|
| `<<e:account_age>>` | Whole value. JSON keeps the type (`42`). Other formats send the text `42`. |
| `"<<e:account_age>>"` | Quoted whole angle. See the results below. |
| `"asda<<e:account_age>>"` | Text before the token. Sent as `asda42`. |
| `"<<e:account_age>>asas"` | Text after the token. Sent as `42asas`. |
| `"asda<<e:feature_enabled>>asas"` | Text on both sides. Sent as `asdatrueasas`. |
| `{{e:plan_label}}` | Unquoted curly, same as a bare token. JSON keeps the string `"10"`. |
| `"{{e:account_age}}"` | Quoted curly. JSON, XML, and form send `{{42}}`. Headers and query send `{{envVariables.account_age}}`. |
| `<<e:service_url[0:8]>>` | Part of a string. Sent as `https://`. |
| `"x<<e:region>>y"` | A missing name inside text. Sent as `xe:regiony`. |

`"asda<<token>>"` and `"<<token>>asas"` are strings in every format. `<<i:age>>`, `<<r:int(10,20)>>`, and `<<c:epoch>>` follow the same whole-value rule as `e:`.

A quoted `"<<token>>"` is not the same in every place. The tests expect:

| | JSON | XML | form | header and query |
|---|---|---|---|---|
| `"<<e:account_age>>"` | `42` | `&lt;&lt;42&gt;&gt;` | `<<e:account_age>>` | `envVariables.account_age` |
| `"{{e:account_age}}"` | `{{42}}` | `{{42}}` | `{{42}}` | `{{envVariables.account_age}}` |
| `"<<i:username>>"` | `alice` | `&lt;&lt;alice&gt;&gt;` | `<<i:username>>` | `<<i:username>>` |
| `"<<r:int(10,20)>>"` | a number from 10 to 20 | `&lt;&lt;10&gt;&gt;` through `&lt;&lt;20&gt;&gt;` | `<<r:int(10,20)>>` | `<<r:int(10,20)>>` |
| `"<<c:day>>"` | the weekday name | `&lt;&lt;Sunday&gt;&gt;` and the other weekdays | `<<c:day>>` | `<<c:day>>` |

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

Each API lists `outputs` for the echoed fields. `test/env_test.mmt`, `test/input_test.mmt`, `test/random_test.mmt`, and `test/current_test.mmt` assert those values. `suite.mmt` runs all four.

## How to use

Open any file in `api/` and click **Send**. Open a file in `test/`, or `suite.mmt`, and click **Run**.

```sh
npx testlight run examples/professional/11_token_resolution/test/env_test.mmt \
  --env-file examples/professional/11_token_resolution/multimeter.mmt
npx testlight run examples/professional/11_token_resolution/test/input_test.mmt
npx testlight run examples/professional/11_token_resolution/suite.mmt \
  --env-file examples/professional/11_token_resolution/multimeter.mmt
```
