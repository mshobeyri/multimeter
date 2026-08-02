# Saving

The Multimeter HTTP Test Editor shows `.http` and `.https` files as runnable test flows, but the structured UI is read-only for HTTP files. Multimeter does not rewrite `.http` files from the flow editor, so it avoids interfering with other REST Client or JetBrains HTTP Client tooling.

Use **Save as MMT** from the HTTP Test Editor to create an editable `.mmt` test file from the parsed HTTP requests. The generated `.mmt` file can then be edited with Multimeter's normal test UI.

You can still edit the raw `.http` source text directly when the file is opened as text.
