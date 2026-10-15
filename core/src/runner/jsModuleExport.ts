/**
 * Discover top-level function bindings in a helper JS source string.
 * Used to auto-export plain `function foo()` / `const foo = () => {}` helpers
 * without requiring `module.exports`.
 */
export function extractTopLevelFunctionNames(source: string): string[] {
  const stripped = stripJsCommentsAndStrings(source);
  const names: string[] = [];
  const seen = new Set<string>();

  const patterns = [
    // function foo( / async function foo(
    /\basync\s+function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g,
    /\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g,
    // const/let/var foo = function / async function / (
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\()/g,
  ];

  for (const re of patterns) {
    let match: RegExpExecArray|null;
    while ((match = re.exec(stripped)) !== null) {
      const name = match[1];
      if (!name || seen.has(name)) {
        continue;
      }
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

/** Strip comments and string/template literals so regexes don't see fake names. */
export function stripJsCommentsAndStrings(source: string): string {
  let out = '';
  let i = 0;
  const s = source;
  while (i < s.length) {
    const ch = s[i];
    const next = s[i + 1];

    // Line comment
    if (ch === '/' && next === '/') {
      i += 2;
      while (i < s.length && s[i] !== '\n') {
        i++;
      }
      continue;
    }
    // Block comment
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) {
        i++;
      }
      i += 2;
      continue;
    }
    // Single / double quoted string
    if (ch === '\'' || ch === '"') {
      const quote = ch;
      out += ' ';
      i++;
      while (i < s.length) {
        if (s[i] === '\\') {
          i += 2;
          continue;
        }
        if (s[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    // Template literal (best-effort; nested ${} not fully parsed)
    if (ch === '`') {
      out += ' ';
      i++;
      while (i < s.length) {
        if (s[i] === '\\') {
          i += 2;
          continue;
        }
        if (s[i] === '`') {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    out += ch;
    i++;
  }
  return out;
}

/**
 * Wrap helper source as a CommonJS-like module, auto-attaching top-level
 * functions onto `module.exports` when they are not already exported.
 */
export function wrapJsHelperModuleSource(sourceText: string): string {
  const names = extractTopLevelFunctionNames(sourceText);
  const autoAttach = names.length === 0 ?
      '' :
      [
        `;(function(){`,
        `  var exp = module.exports;`,
        `  if (exp == null || typeof exp !== "object" || Array.isArray(exp)) {`,
        `    return;`,
        `  }`,
        ...names.map((name) => {
          const key = JSON.stringify(name);
          return (
            `  try {` +
            ` if (typeof ${name} === "function" && exp[${key}] === undefined) {` +
            ` exp[${key}] = ${name};` +
            ` }` +
            ` } catch (_e) {}`
          );
        }),
        `})();`,
      ].join('\n');

  return (
      `"use strict";\n` +
      `let exports = module.exports;\n` +
      `${sourceText}\n` +
      `${autoAttach}\n` +
      `return module.exports;\n`);
}
