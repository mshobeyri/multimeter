import { getOpOptionLabel, selectableOpsList } from "mmt-core/TestData";
import { safeList } from "mmt-core/safer";

/** Monaco-agnostic completion item (the caller adds `kind` and `range`). */
export interface OperatorSuggestion {
  label: string;
  filterText: string;
  insertText: string;
  detail: string;
  documentation: string;
  sortText: string;
}

/**
 * `quoted` targets the object form (`operator: "=="`).
 * `inline` targets expect/debug values (`status_code: == 200`).
 */
export type OperatorSuggestionMode = "quoted" | "inline";

interface OperatorHelp {
  detail: string;
  documentation: string;
  example?: string;
}

const OPERATOR_HELP: Record<string, OperatorHelp> = {
  "==": { detail: "Equal", documentation: "Checks equality (type-safe).", example: "status_code: == 200" },
  "!=": { detail: "Not equal", documentation: "Checks inequality (type-safe).", example: "token: != null" },
  ">": { detail: "Greater than", documentation: "Checks actual > expected.", example: "count: > 0" },
  ">=": { detail: "Greater than or equal", documentation: "Checks actual >= expected.", example: "count: >= 1" },
  "<": { detail: "Less than", documentation: "Checks actual < expected.", example: "latency: < 1000" },
  "<=": { detail: "Less than or equal", documentation: "Checks actual <= expected.", example: "retries: <= 3" },
  "=@": { detail: "Is in", documentation: "Checks actual is contained in expected (expected.includes(actual)).", example: "word: =@ sentence" },
  "!@": { detail: "Is not in", documentation: "Checks actual is not contained in expected.", example: "word: !@ sentence" },
  "=C": { detail: "Contains", documentation: "Checks actual contains expected (actual.includes(expected)).", example: "body: =C success" },
  "!C": { detail: "Not contains", documentation: "Checks actual does not contain expected.", example: "body: !C error" },
  "=^": { detail: "Starts with", documentation: "Checks actual starts with expected.", example: "url: =^ https://" },
  "!^": { detail: "Not starts with", documentation: "Checks actual does not start with expected.", example: "url: !^ http://" },
  "=$": { detail: "Ends with", documentation: "Checks actual ends with expected.", example: "file: =$ .json" },
  "!$": { detail: "Not ends with", documentation: "Checks actual does not end with expected.", example: "file: !$ .tmp" },
  "=*": { detail: "Regex match", documentation: "Checks actual matches the expected regex.", example: "email: =* /@example\\.com$/" },
  "!*": { detail: "Regex not match", documentation: "Checks actual does not match the expected regex.", example: "name: !* /^admin/" },
  "=~": {
    detail: "Equal (type-unsafe)",
    documentation: "Compares both sides as strings, so XML/text values match YAML booleans and numbers.",
    example: "active: =~ true",
  },
  "!~": {
    detail: "Not equal (type-unsafe)",
    documentation: "Compares both sides as strings and passes when they differ.",
    example: "code: !~ 0",
  },
  "=#": { detail: "Length/count equals", documentation: "Checks array/object item count, or string/number character length.", example: "users: =# 3" },
  "!#": { detail: "Length/count not equals", documentation: "Checks the length/count is not the expected value.", example: "users: !# 0" },
  "<#": { detail: "Length/count less than", documentation: "Checks the length/count is less than expected.", example: "errors: <# 3" },
  "<=#": { detail: "Length/count less or equal", documentation: "Checks the length/count is less than or equal to expected.", example: "errors: <=# 2" },
  ">#": { detail: "Length/count greater than", documentation: "Checks the length/count is greater than expected.", example: "users: ># 0" },
  ">=#": { detail: "Length/count greater or equal", documentation: "Checks the length/count is greater than or equal to expected.", example: "users: >=# 1" },
  "=i": { detail: "Equal (ignore case)", documentation: "Compares as text, ignoring case.", example: "name: =i john" },
  "!i": { detail: "Not equal (ignore case)", documentation: "Compares as text, ignoring case, and passes when they differ.", example: "name: !i admin" },
  "=X": { detail: "Equal (trim)", documentation: "Compares as text after trimming both sides.", example: "name: =X John" },
  "!X": { detail: "Not equal (trim)", documentation: "Compares as text after trimming and passes when they differ.", example: "name: !X John" },
  "=iX": { detail: "Equal (trim, ignore case)", documentation: "Compares as text after trimming, ignoring case.", example: "name: =iX john" },
  "!iX": { detail: "Not equal (trim, ignore case)", documentation: "Compares as text after trimming, ignoring case, and passes when they differ.", example: "name: !iX admin" },
  ">%": { detail: "Fuzzy match", documentation: "Checks actual is at least N% similar to expected.", example: 'name: ">80% Jon"' },
  "<%": { detail: "Not fuzzy match", documentation: "Checks actual is less than N% similar to expected.", example: "name: <80% admin" },
};

/** Fuzzy operators carry a percentage, so they insert a concrete default. */
const FUZZY_OVERRIDES: Record<string, {label: string; quoted: string; inline: string}> = {
  ">%": { label: '>N% — fuzzy match at least percent', quoted: ' ">%"', inline: ' ">80%" ' },
  "<%": { label: '<N% — fuzzy match less than percent', quoted: ' "<%"', inline: ' <80% ' },
};

/**
 * Operator completions derived from `selectableOpsList`, so every operator the
 * UI can select is also offered in the YAML editor.
 */
export function buildOperatorSuggestions(
  mode: OperatorSuggestionMode,
): OperatorSuggestion[] {
  return safeList(selectableOpsList).map((op, index) => {
    const help = OPERATOR_HELP[op];
    const fuzzy = FUZZY_OVERRIDES[op];
    const documentation = help
      ? [help.documentation, help.example ? `Example: ${help.example}` : ""]
          .filter(Boolean)
          .join("\n")
      : getOpOptionLabel(op);
    const insertText = fuzzy
      ? (mode === "quoted" ? fuzzy.quoted : fuzzy.inline)
      : (mode === "quoted" ? ` "${op}"` : ` ${op} `);
    return {
      label: fuzzy?.label ?? getOpOptionLabel(op),
      filterText: op,
      insertText,
      detail: help?.detail ?? op,
      documentation,
      sortText: String(index).padStart(2, "0"),
    };
  });
}

/** Comma-separated operator list for `check` / `assert` documentation blurbs. */
export function operatorListText(): string {
  return safeList(selectableOpsList).join(", ");
}
