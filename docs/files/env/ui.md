# Edit in the UI

## Edit environments in the UI
- You can modify variables and set presets using the UI panels.
- From the Environment panel, you can pick preset groups and values, then:
  - Click "Set To Workspace" to apply your changes to the Environment Variables workspace.
  - Click "Clear Workspace" to clear the Environment Variables from workspace.


![Environment panel](../screenshots/environment_panel.png)

- You can change variable selections and values directly in the Environment Variables panel. Choices (like url/test_type) are offered as dropdowns; plain values can be edited inline. Edits are saved back to your `.mmt` env file.

![Environment variables UI](../screenshots/environment_variables_ui.png)

## Promote values to env during runs
In API definitions, use `setenv` to capture values from responses for later steps. Values use the same extraction expressions as `outputs`:
```yaml
setenv:
  token: body[token]
```
