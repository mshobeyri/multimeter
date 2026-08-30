# Bruno file examples

These examples show `.bru` files that can be opened through **Open With...** → **Multimeter Bruno Test Editor**, or **Open as MMT**.

Use **As API** to send the request in the API tester. Use **As Test** to run the request (or the whole collection) as a test flow. The structured UI is read-only; **Save as MMT** writes an editable `.mmt` file from the current view.

## Files

- `library/`: a Bruno collection (`bruno.json` plus several request files). Open any file in that folder to pick requests from the selector, or run the collection as one test.
- `checkout_book_complete.bru`: one complete standalone request with meta, docs, vars, headers, query params, bearer auth, a JSON body, and several `expect` checks.
- `get_profile.bru`: a simple Bruno GET request with variables, headers, bearer auth, query params, and assertions.
- `create_user_json.bru`: a POST request with a JSON body and bearer auth.
- `update_profile_form.bru`: a PUT request with a form-urlencoded body.
- `delete_user_api_key.bru`: a DELETE request using API key auth in a header.
- `xml_echo.bru`: a POST request with an XML text body.
- `import_bruno_in_test.mmt`: a Multimeter test that imports a `.bru` file and calls it like any other test import.

## Importing Bruno Files From MMT

`.bru` files can be imported from `type: test` files. Multimeter converts them to test flows internally, so a normal `call` step can run the Bruno request.

```yaml
type: test
title: Import Bruno request
import:
  profile: get_profile.bru
  createUser: create_user_json.bru
  updateProfile: update_profile_form.bru
  deleteApiKey: delete_user_api_key.bru
  xmlEcho: xml_echo.bru
  checkout: checkout_book_complete.bru
steps:
  - call: profile
  - call: createUser
  - call: updateProfile
  - call: deleteApiKey
  - call: xmlEcho
  - call: checkout
```
