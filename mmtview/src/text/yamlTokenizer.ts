import { opsList } from 'mmt-core/TestData';

type TagHandleRule = [RegExp, string];

/**
 * Build tag-handle rules for Monaco's YAML tokenizer.
 * MMT comparison operators starting with `!` must be matched before the
 * generic YAML tag rule (`!tagname`), otherwise they are highlighted as tags.
 */
export function buildMmtTagHandleRules(): TagHandleRule[] {
  const rules: TagHandleRule[] = [];

  const exclamOps = opsList
    .filter(op => op.startsWith('!'))
    .sort((a, b) => b.length - a.length);

  for (const op of exclamOps) {
    const escaped = op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    rules.push([new RegExp(escaped + '(?=[ \\t"\']|$)'), 'mmt.operator']);
  }

  // Fuzzy-percent operators such as >75% / <75%
  rules.push([/[<>](?:0|[1-9][0-9]?|100)%(?=[ \t"']|$)/, 'mmt.operator']);
  rules.push([/[<>]%(?=[ \t"']|$)/, 'mmt.operator']);

  rules.push([/![^ ]*/, 'tag']);
  return rules;
}

// Based on monaco-languages/src/yaml/yaml.ts with MMT-specific tag exclusions.
const mmtYamlLanguage = {
  tokenPostfix: '.yaml',

  brackets: [
    { token: 'delimiter.bracket', open: '{', close: '}' },
    { token: 'delimiter.square', open: '[', close: ']' }
  ],

  keywords: ['true', 'True', 'TRUE', 'false', 'False', 'FALSE', 'null', 'Null', 'Null', '~'],

  numberInteger: /(?:0|[+-]?[0-9]+)/,
  numberFloat: /(?:0|[+-]?[0-9]+)(?:\.[0-9]+)?(?:e[-+][1-9][0-9]*)?/,
  numberOctal: /0o[0-7]+/,
  numberHex: /0x[0-9a-fA-F]+/,
  numberInfinity: /[+-]?\.(?:inf|Inf|INF)/,
  numberNaN: /\.(?:nan|Nan|NAN)/,
  numberDate: /\d{4}-\d\d-\d\d([Tt ]\d\d:\d\d:\d\d(\.\d+)?(( ?[+-]\d\d?(:\d\d)?)|Z)?)?/,

  escapes: /\\(?:[btnfr\\"']|[0-7][0-7]?|[0-3][0-7]{2})/,

  tokenizer: {
    root: [
      { include: '@whitespace' },
      { include: '@comment' },

      [/%[^ ]+.*$/, 'meta.directive'],

      [/---/, 'operators.directivesEnd'],
      [/^\s*\.{3}\s*(?:#.*)?$/, 'operators.documentEnd'],

      [/[-?:](?= )/, 'operators'],

      { include: '@anchor' },
      { include: '@tagHandle' },
      { include: '@flowCollections' },
      { include: '@blockStyle' },

      [/@numberInteger(?![ \t]*\S+)/, 'number'],
      [/@numberFloat(?![ \t]*\S+)/, 'number.float'],
      [/@numberOctal(?![ \t]*\S+)/, 'number.octal'],
      [/@numberHex(?![ \t]*\S+)/, 'number.hex'],
      [/@numberInfinity(?![ \t]*\S+)/, 'number.infinity'],
      [/@numberNaN(?![ \t]*\S+)/, 'number.nan'],
      [/@numberDate(?![ \t]*\S+)/, 'number.date'],

      [/(".*?"|'.*?'|.*?)([ \t]*)(:)( |$)/, ['type', 'white', 'operators', 'white']],

      { include: '@flowScalars' },

      [/.+$/, {
        cases: {
          '@keywords': 'keyword',
          '@default': 'string'
        }
      }]
    ],

    object: [
      { include: '@whitespace' },
      { include: '@comment' },

      [/\}/, '@brackets', '@pop'],

      [/,/, 'delimiter.comma'],

      [/:(?= )/, 'operators'],

      [/(?:".*?"|'.*?'|[^[{,]+?)(?=: )/, 'type'],

      { include: '@flowCollections' },
      { include: '@flowScalars' },

      { include: '@tagHandle' },
      { include: '@anchor' },
      { include: '@flowNumber' },

      [/[^},]+/, {
        cases: {
          '@keywords': 'keyword',
          '@default': 'string'
        }
      }]
    ],

    array: [
      { include: '@whitespace' },
      { include: '@comment' },

      [/\]/, '@brackets', '@pop'],

      [/,/, 'delimiter.comma'],

      { include: '@flowCollections' },
      { include: '@flowScalars' },

      { include: '@tagHandle' },
      { include: '@anchor' },
      { include: '@flowNumber' },

      [/[^\],]+/, {
        cases: {
          '@keywords': 'keyword',
          '@default': 'string'
        }
      }]
    ],

    multiString: [
      [/^( +).+$/, 'string', '@multiStringContinued.$1']
    ],

    multiStringContinued: [
      [/^( *).+$/, {
        cases: {
          '$1==$S2': 'string',
          '@default': { token: '@rematch', next: '@popall' }
        }
      }]
    ],

    whitespace: [
      [/[ \t\r\n]+/, 'white']
    ],

    comment: [
      [/#.*$/, 'comment']
    ],

    flowCollections: [
      [/\[/, '@brackets', '@array'],
      [/\{/, '@brackets', '@object']
    ],

    flowScalars: [
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/'([^'\\]|\\.)*$/, 'string.invalid'],
      [/'[^']*'/, 'string'],
      [/"/, 'string', '@doubleQuotedString']
    ],

    doubleQuotedString: [
      [/[^\\"]+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/"/, 'string', '@pop']
    ],

    blockStyle: [
      [/[>|][0-9]*[+-]?$/, 'operators', '@multiString']
    ],

    flowNumber: [
      [/@numberInteger(?=[ \t]*[,[\]}])/, 'number'],
      [/@numberFloat(?=[ \t]*[,[\]}])/, 'number.float'],
      [/@numberOctal(?=[ \t]*[,[\]}])/, 'number.octal'],
      [/@numberHex(?=[ \t]*[,[\]}])/, 'number.hex'],
      [/@numberInfinity(?=[ \t]*[,[\]}])/, 'number.infinity'],
      [/@numberNaN(?=[ \t]*[,[\]}])/, 'number.nan'],
      [/@numberDate(?=[ \t]*[,[\]}])/, 'number.date']
    ],

    tagHandle: buildMmtTagHandleRules(),

    anchor: [
      [/[&*][^ ]+/, 'namespace']
    ]
  }
};

let registered = false;

export function registerMmtYamlTokenizer(monaco: any): void {
  if (registered) {
    return;
  }
  registered = true;
  monaco.languages.setMonarchTokensProvider('yaml', mmtYamlLanguage);
}
