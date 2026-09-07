# Postman convert (basic)

`source.postman_collection.json` is a one-request collection. **Convert to MMT...** produces API, test, and suite files under `converted/`.

The converted test keeps a `js` step that checks status with Multimeter helpers (`check_`, `equals_`, step `id` `iPing`). Postman `pm.*` is not available at runtime.

See the [convert overview](../README.md) for the other formats.
