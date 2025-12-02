export const FIXED_BG_THEME = "fixed-bg-theme";

export const defineTheme = (monaco: any) => {
  const cssVar = (name: string, fallback: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name)?.trim() || fallback;

  // Detect if current theme is light or dark
  const isDarkTheme = () => {
    const bgColor = cssVar('--vscode-editor-background', '#1e1e1e');
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 128;
  };

  const isLight = !isDarkTheme();

  // Define token colors for light and dark themes
  const tokenColors = {
    dark: {
      yamlKey: "3ec9b1",
      yamlString: "cf9178",
      yamlNumber: "b6cea8",
      yamlTag: "F07178",
      jsonKey: "3ec9b1",
      jsonString: "cf9178",
      jsonNumber: "F77669",
      xmlTag: "3ec9b1",
      xmlAttrName: "b6cea8",
      xmlAttrValue: "cf9178",
      xmlString: "cf9178",
      xmlComment: "618b4f",
      delimiter: "d4d4d4"
    },
    light: {
      yamlKey: "0f7b6c",
      yamlString: "a31e22",
      yamlNumber: "0f5132",
      yamlTag: "b02a37",
      jsonKey: "0f7b6c",
      jsonString: "a31e22",
      jsonNumber: "b02a37",
      xmlTag: "0f7b6c",
      xmlAttrName: "0f5132",
      xmlAttrValue: "a31e22",
      xmlString: "a31e22",
      xmlComment: "0f5132",
      delimiter: "495057"
    }
  };

  const colors = isLight ? tokenColors.light : tokenColors.dark;

  monaco.editor.defineTheme(FIXED_BG_THEME, {
    base: isLight ? "vs" : "vs-dark",
    inherit: true,
    rules: [
      // YAML tokens
      { token: "key", foreground: colors.yamlKey },
      { token: "string", foreground: colors.yamlString },
      { token: "number", foreground: colors.yamlNumber },
      { token: "type", foreground: colors.yamlKey },
      { token: "delimiter", foreground: colors.delimiter },
      { token: "delimiter.yaml", foreground: colors.delimiter },
      { token: "tag", foreground: colors.yamlTag },

      // JSON tokens
      { token: "string.key.json", foreground: colors.jsonKey },
      { token: "string.value.json", foreground: colors.jsonString },
      { token: "number", foreground: colors.jsonNumber },
      { token: "keyword.json", foreground: colors.delimiter },
      { token: "delimiter.json", foreground: colors.delimiter },

      // XML tokens
      { token: "tag.xml", foreground: colors.xmlTag },
      { token: "attribute.name.xml", foreground: colors.xmlAttrName },
      { token: "attribute.value.xml", foreground: colors.xmlAttrValue },
      { token: "string.xml", foreground: colors.xmlString },
      { token: "comment.xml", foreground: colors.xmlComment },
      { token: "delimiter.xml", foreground: colors.delimiter },
    ],
    colors: {
      // Editor background and foreground
      "editor.background": cssVar('--vscode-editor-background', "#1e1e1e"),

      // Line numbers
      "editorLineNumber.foreground": cssVar('--vscode-editorLineNumber-foreground', "#858585"),
      "editorLineNumber.activeForeground": cssVar('--vscode-editorLineNumber-activeForeground', "#c6c6c6"),

      // Cursor
      "editorCursor.foreground": cssVar('--vscode-editorCursor-foreground', "#aeafad"),

      // Selection & highlights
      "editor.selectionBackground": cssVar('--vscode-editor-selectionBackground', "#264f78"),
      "editor.selectionForeground": cssVar('--vscode-editor-selectionForeground', "#ffffff"),
      "editor.inactiveSelectionBackground": cssVar('--vscode-editor-inactiveSelectionBackground', "#264f78"),
      "editor.inactiveSelectedForeground": cssVar('--vscode-editor-inactiveSelectedForeground', "#ffffff"),
      "editor.lineHighlightBorder": cssVar('--vscode-editor-lineHighlightBorder', "transparent"),

      // Widgets
      "editorWidget.background": cssVar('--vscode-editorWidget-background', "#232323"),
      "editorWidget.border": cssVar('--vscode-editorWidget-border', "#454545"),

      // Suggest widget
      "editorSuggestWidget.background": cssVar('--vscode-editorSuggestWidget-background', "#252526"),
      "editorSuggestWidget.border": cssVar('--vscode-editorSuggestWidget-border', "#454545"),
      "editorSuggestWidget.foreground": cssVar('--vscode-editorSuggestWidget-foreground', "#d4d4d4"),
      "editorSuggestWidget.selectedForeground": cssVar('--vscode-editorSuggestWidget-selectedForeground', "#d4d4d4"),
      "editorSuggestWidget.selectedBackground": cssVar('--vscode-editorSuggestWidget-selectedBackground', "#2c2c2c"),

      // Markers
      "editorError.foreground": cssVar('--vscode-editorError-foreground', "#f48771"),
      "editorWarning.foreground": cssVar('--vscode-editorWarning-foreground', "#cca700"),
      "editorInfo.foreground": cssVar('--vscode-editorInfo-foreground', "#75beff"),

      // Diff editor
      "diffEditor.insertedTextBackground": cssVar('--vscode-diffEditor-insertedTextBackground', "#00809b33"),
      "diffEditor.removedTextBackground": cssVar('--vscode-diffEditor-removedTextBackground', "#a3151533"),

      "editorOverviewRuler.errorForeground": cssVar('--vscode-editorError-foreground', "#f48771"),
      "editorOverviewRuler.warningForeground": cssVar('--vscode-editorWarning-foreground', "#cca700"),
      "editorOverviewRuler.infoForeground": cssVar('--vscode-editorInfo-foreground', "#75beff"),
      "symbolIcon.arrayForeground": cssVar('--vscode-symbolIcon-arrayForeground', "#cccccc"),
      "symbolIcon.booleanForeground": cssVar('--vscode-symbolIcon-booleanForeground', "#cccccc"),
      "symbolIcon.classForeground": cssVar('--vscode-symbolIcon-classForeground', "#ee9d28"),
      "symbolIcon.colorForeground": cssVar('--vscode-symbolIcon-colorForeground', "#cccccc"),
      "symbolIcon.constantForeground": cssVar('--vscode-symbolIcon-constantForeground', "#cccccc"),
      "symbolIcon.constructorForeground": cssVar('--vscode-symbolIcon-constructorForeground', "#b180d7"),
      "symbolIcon.enumeratorForeground": cssVar('--vscode-symbolIcon-enumeratorForeground', "#ee9d28"),
      "symbolIcon.enumeratorMemberForeground": cssVar('--vscode-symbolIcon-enumeratorMemberForeground', "#75beff"),
      "symbolIcon.eventForeground": cssVar('--vscode-symbolIcon-eventForeground', "#ee9d28"),
      "symbolIcon.fieldForeground": cssVar('--vscode-symbolIcon-fieldForeground', "#75beff"),
      "symbolIcon.fileForeground": cssVar('--vscode-symbolIcon-fileForeground', "#cccccc"),
      "symbolIcon.folderForeground": cssVar('--vscode-symbolIcon-folderForeground', "#cccccc"),
      "symbolIcon.functionForeground": cssVar('--vscode-symbolIcon-functionForeground', "#b180d7"),
      "symbolIcon.interfaceForeground": cssVar('--vscode-symbolIcon-interfaceForeground', "#75beff"),
      "symbolIcon.keyForeground": cssVar('--vscode-symbolIcon-keyForeground', "#3ec9b1"),
      "symbolIcon.keywordForeground": cssVar('--vscode-symbolIcon-keywordForeground', "#569cd6"),
      "symbolIcon.methodForeground": cssVar('--vscode-symbolIcon-methodForeground', "#b180d7"),
      "symbolIcon.moduleForeground": cssVar('--vscode-symbolIcon-moduleForeground', "#cccccc"),
      "symbolIcon.namespaceForeground": cssVar('--vscode-symbolIcon-namespaceForeground', "#cccccc"),
      "symbolIcon.nullForeground": cssVar('--vscode-symbolIcon-nullForeground', "#cccccc"),
      "symbolIcon.numberForeground": cssVar('--vscode-symbolIcon-numberForeground', "#b6cea8"),
      "symbolIcon.objectForeground": cssVar('--vscode-symbolIcon-objectForeground', "#cccccc"),
      "symbolIcon.operatorForeground": cssVar('--vscode-symbolIcon-operatorForeground', "#cccccc"),
      "symbolIcon.packageForeground": cssVar('--vscode-symbolIcon-packageForeground', "#cccccc"),
      "symbolIcon.propertyForeground": cssVar('--vscode-symbolIcon-propertyForeground', "#3ec9b1"), 
      "symbolIcon.referenceForeground": cssVar('--vscode-symbolIcon-referenceForeground', "#cccccc"),
      "symbolIcon.snippetForeground": cssVar('--vscode-symbolIcon-snippetForeground', "#cccccc"),
      "symbolIcon.stringForeground": cssVar('--vscode-symbolIcon-stringForeground', "#cf9178"), 
      "symbolIcon.structForeground": cssVar('--vscode-symbolIcon-structForeground', "#cccccc"),
      "symbolIcon.textForeground": cssVar('--vscode-symbolIcon-textForeground', "#cccccc"),
      "symbolIcon.typeParameterForeground": cssVar('--vscode-symbolIcon-typeParameterForeground', "#cccccc"),
      "symbolIcon.unitForeground": cssVar('--vscode-symbolIcon-unitForeground', "#cccccc"),
      "symbolIcon.variableForeground": cssVar('--vscode-symbolIcon-variableForeground', "#75beff"),
    },
  });
};