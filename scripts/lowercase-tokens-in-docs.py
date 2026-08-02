#!/usr/bin/env python3
"""Lowercase Multimeter token names and env variable names in docs/examples."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ROOTS = [
    ROOT / "docs",
    ROOT / "examples",
    ROOT / "website" / "content",
]

TOKEN_INLINE_RE = re.compile(
    r"<<([eiorc]):([A-Za-z_][A-Za-z0-9_]*)>>",
)
TOKEN_STANDALONE_RE = re.compile(
    r"(?<![a-zA-Z0-9_])([eiorc]):([A-Za-z_][A-Za-z0-9_]*)",
)
ANGLE_PLACEHOLDER_RE = re.compile(
    r"<([A-Z][A-Z0-9_]*)>",
)
DOLLAR_PLACEHOLDER_RE = re.compile(
    r"\$\{([A-Z][A-Z0-9_]*)\}",
)

# Uppercase YAML keys that are Multimeter env/setenv variable names (in code blocks).
ENV_KEY_LINE_RE = re.compile(
    r"^(\s*)([A-Z][A-Z0-9_]*)(:)(?=\s|$)",
)

# CLI -e KEY=VALUE overrides for env vars.
CLI_ENV_OVERRIDE_RE = re.compile(
    r"(?<![a-zA-Z0-9_])([A-Z][A-Z0-9_]*)=",
)

# Prose/backtick env var names like `API_URL`.
BACKTICK_ENV_RE = re.compile(
    r"`([A-Z][A-Z0-9_]*)`",
)

# setenv / env token references in backticks like e:TOKEN
BACKTICK_TOKEN_RE = re.compile(
    r"`([eiorc]):([A-Za-z_][A-Za-z0-9_]*)`",
)

HTTP_HEADER_NAMES = {
    "CONTENT-TYPE",
    "AUTHORIZATION",
    "ACCEPT",
    "USER-AGENT",
    "X-MOCK-ENV",
}

SKIP_UPPER_WORDS = {
    "HTTP",
    "HTTPS",
    "WS",
    "WSS",
    "URL",
    "API",
    "CLI",
    "YAML",
    "JSON",
    "XML",
    "HTML",
    "CSV",
    "VS",
    "POST",
    "GET",
    "PUT",
    "DELETE",
    "PATCH",
    "HEAD",
    "OPTIONS",
    "TRACE",
    "JWT",
    "OAuth2",
    "PASSED",
    "FAILED",
    "TOTAL",
    "DURATION",
    "TITLE",
    "DESCRIPTION",
    "NAME",
    "VAR",
    "TYPE",
    "ID",
    "UI",
    "CI",
    "CD",
    "MMT",
    "WS",
    "GRPC",
    "SOAP",
    "BOM",
    "AND",
    "OR",
    "NOT",
    "CRUD",
    "ISO",
    "TTL",
    "BASIC",
    "BEARER",
    "OAuth",
    "JUnit",
    "MMT",
    "VS",
    "CODE",
    "EDIT",
    "RUN",
    "SEND",
    "CANCEL",
    "RESET",
    "EXPORT",
    "IMPORT",
    "LOGO",
    "TRIABLE",
    "OVERVIEW",
    "REPORT",
    "FLOW",
    "CODE",
    "INTERFACE",
    "METHOD",
    "STATUS",
    "DEBUG",  # keep in prose when not env var? we'll handle contextually
}


def lower_name(name: str) -> str:
    return name.lower()


def lower_token_name(name: str) -> str:
    # snake_case camelCase → snake_case for input/env names
    s = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", name)
    return s.lower()


def replace_tokens(text: str) -> tuple[str, int]:
    count = 0

    def inline_repl(m: re.Match[str]) -> str:
        nonlocal count
        prefix, name = m.group(1), m.group(2)
        new_name = lower_token_name(name)
        if new_name != name:
            count += 1
        return f"<<{prefix}:{new_name}>>"

    def standalone_repl(m: re.Match[str]) -> str:
        nonlocal count
        prefix, name = m.group(1), m.group(2)
        new_name = lower_token_name(name)
        if new_name != name:
            count += 1
        return f"{prefix}:{new_name}"

    text = TOKEN_INLINE_RE.sub(inline_repl, text)

    def standalone_guarded(m: re.Match[str]) -> str:
        prefix, name = m.group(1), m.group(2)
        # Skip if already processed inside << >>
        return standalone_repl(m)

    text = TOKEN_STANDALONE_RE.sub(standalone_guarded, text)

    def angle_repl(m: re.Match[str]) -> str:
        nonlocal count
        name = m.group(1)
        new_name = lower_name(name)
        if new_name != name:
            count += 1
        return f"<{new_name}>"

    text = ANGLE_PLACEHOLDER_RE.sub(angle_repl, text)

    def dollar_repl(m: re.Match[str]) -> str:
        nonlocal count
        name = m.group(1)
        new_name = lower_name(name)
        if new_name != name:
            count += 1
        return f"${{{new_name}}}"

    text = DOLLAR_PLACEHOLDER_RE.sub(dollar_repl, text)

    def backtick_token_repl(m: re.Match[str]) -> str:
        nonlocal count
        prefix, name = m.group(1), m.group(2)
        new_name = lower_token_name(name)
        if new_name != name:
            count += 1
        return f"`{prefix}:{new_name}`"

    text = BACKTICK_TOKEN_RE.sub(backtick_token_repl, text)

    return text, count


def replace_env_keys_in_code_blocks(text: str) -> tuple[str, int]:
    count = 0
    out = []
    in_fence = False
    fence_lang = ""
    in_setenv_or_variables = False
    indent_stack: list[int] = []

    for line in text.splitlines(keepends=True):
        stripped = line.lstrip()
        if stripped.startswith("```"):
            in_fence = not in_fence
            if in_fence:
                fence_lang = stripped[3:].strip().lower()
            else:
                fence_lang = ""
                in_setenv_or_variables = False
                indent_stack = []
            out.append(line)
            continue

        if not in_fence or fence_lang not in ("", "yaml", "yml", "mmt"):
            out.append(line)
            continue

        key_match = re.match(r"^(\s*)([a-zA-Z_][a-zA-Z0-9_]*):\s*", line)
        if key_match:
            key = key_match.group(2)
            indent = len(key_match.group(1))
            if key in ("variables", "setenv", "environment"):
                in_setenv_or_variables = True
                indent_stack = [indent]
            elif in_setenv_or_variables:
                while indent_stack and indent <= indent_stack[-1] and key not in (
                    "variables",
                    "setenv",
                    "presets",
                    "setting",
                    "certificates",
                    "items",
                    "steps",
                    "inputs",
                    "outputs",
                    "examples",
                    "headers",
                    "query",
                    "cookies",
                    "body",
                    "auth",
                    "graphql",
                    "grpc",
                    "import",
                    "tags",
                    "title",
                    "description",
                    "type",
                    "url",
                    "method",
                    "protocol",
                    "format",
                    "name",
                    "threads",
                    "repeat",
                    "test",
                    "stages",
                    "then",
                    "report",
                    "debug",
                    "cache",
                    "flow",
                    "id",
                    "condition",
                    "after",
                    "repeat",
                    "delay",
                    "if",
                    "else",
                    "for",
                    "run",
                    "check",
                    "assert",
                    "js",
                    "print",
                    "set",
                    "var",
                    "const",
                    "let",
                    "data",
                    "http",
                    "ws",
                    "match",
                    "port",
                    "preset",
                    "file",
                    "omit",
                    "operation",
                    "operationname",
                    "sources",
                    "servers",
                    "export",
                    "environment",
                ):
                    indent_stack.pop()
                if not indent_stack:
                    in_setenv_or_variables = False
                elif indent > indent_stack[-1]:
                    pass  # nested under variables/setenv

        m = ENV_KEY_LINE_RE.match(line)
        if m and in_setenv_or_variables:
            key = m.group(2)
            if key.isupper() or (any(c.isupper() for c in key) and "_" in key):
                new_key = lower_name(key)
                if new_key != key:
                    count += 1
                    line = f"{m.group(1)}{new_key}{m.group(3)}{line[m.end():]}"
        elif m and re.search(r"^\s*setenv:\s*$", "".join(out[-3:]) if out else ""):
            pass

        # Suite environment.variables block
        if re.match(r"^\s*variables:\s*$", line) and any(
            "environment:" in prev for prev in out[-5:]
        ):
            in_setenv_or_variables = True
            indent_stack = [len(line) - len(line.lstrip())]

        out.append(line)

    return "".join(out), count


def replace_cli_env_overrides(text: str) -> tuple[str, int]:
    count = 0

    def repl(m: re.Match[str]) -> str:
        nonlocal count
        key = m.group(1)
        if key in SKIP_UPPER_WORDS or key in HTTP_HEADER_NAMES:
            return m.group(0)
        if key.isupper() and len(key) > 1:
            count += 1
            return f"{key.lower()}="
        return m.group(0)

    # Only in lines mentioning -e or testlight env overrides
    lines = []
    for line in text.splitlines(keepends=True):
        if "-e " in line or "`-e`" in line or "testlight" in line.lower():
            line = CLI_ENV_OVERRIDE_RE.sub(repl, line)
        lines.append(line)
    return "".join(lines), count


def replace_prose_env_refs(text: str) -> tuple[str, int]:
    count = 0

    def repl(m: re.Match[str]) -> str:
        nonlocal count
        key = m.group(1)
        if key in SKIP_UPPER_WORDS:
            return m.group(0)
        # Env var names are typically SCREAMING_SNAKE
        if re.fullmatch(r"[A-Z][A-Z0-9_]*", key) and len(key) > 2:
            count += 1
            return f"`{key.lower()}`"
        return m.group(0)

    # Only replace likely env var names in prose (not inside code fences handled separately)
    out = []
    in_fence = False
    for segment, is_fence in _split_fences(text):
        if is_fence:
            out.append(segment)
        else:
            out.append(BACKTICK_ENV_RE.sub(repl, segment))
    return "".join(out), count


def replace_double_brace_var(text: str) -> tuple[str, int]:
    count = 0

    def repl(m: re.Match[str]) -> str:
        nonlocal count
        name = m.group(1)
        new_name = lower_name(name)
        if new_name != name:
            count += 1
        return f"{{{{{new_name}}}}}"

    return re.sub(r"\{\{([A-Z][A-Z0-9_]*)\}\}", repl, text), count


def _split_fences(text: str) -> list[tuple[str, bool]]:
    parts: list[tuple[str, bool]] = []
    pos = 0
    for match in re.finditer(r"```[\s\S]*?```", text):
        if match.start() > pos:
            parts.append((text[pos : match.start()], False))
        parts.append((match.group(0), True))
        pos = match.end()
    if pos < len(text):
        parts.append((text[pos:], False))
    return parts


def process_file(path: Path) -> tuple[str, int]:
    original = path.read_text(encoding="utf-8")
    total = 0
    text = original

    for fn in (
        replace_tokens,
        replace_double_brace_var,
        replace_env_keys_in_code_blocks,
        replace_cli_env_overrides,
        replace_prose_env_refs,
    ):
        text, n = fn(text)
        total += n

    return text, total


def main() -> int:
    roots = [Path(p) for p in sys.argv[1:]] if len(sys.argv) > 1 else ROOTS

    files_touched = 0
    total_replacements = 0
    samples: list[tuple[str, str, str]] = []

    extensions = {".md", ".mmt", ".yaml", ".yml"}

    for root in roots:
        if not root.exists():
            continue
        for path in sorted(root.rglob("*")):
            if path.suffix not in extensions or not path.is_file():
                continue
            original = path.read_text(encoding="utf-8")
            updated, count = process_file(path)
            if updated != original:
                path.write_text(updated, encoding="utf-8")
                files_touched += 1
                total_replacements += count
                # capture a few diffs
                if len(samples) < 8:
                    for o_line, u_line in zip(original.splitlines(), updated.splitlines()):
                        if o_line != u_line:
                            rel = path.relative_to(ROOT)
                            samples.append((str(rel), o_line.strip()[:100], u_line.strip()[:100]))
                            break

    print(f"Files touched: {files_touched}")
    print(f"Replacements (approx): {total_replacements}")
    print("\nSample before → after:")
    for rel, before, after in samples:
        print(f"  [{rel}]")
        print(f"    - {before}")
        print(f"    + {after}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
