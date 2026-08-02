#!/usr/bin/env python3
"""Backtick YAML field names in docs prose (not inside fenced code blocks)."""

from __future__ import annotations

import re
import sys
from pathlib import Path

DOCS_ROOT = Path(__file__).resolve().parent.parent / "docs"

YAML_KEYS = {
    "type", "title", "description", "tags", "url", "method", "body", "format",
    "expect", "call", "import", "steps", "outputs", "inputs", "headers", "query",
    "cookies", "setenv", "report", "debug", "items", "protocol", "timeout", "cache",
    "name", "variables", "presets", "setting", "stages", "then", "servers", "export",
    "environment", "examples", "auth", "graphql", "grpc", "flow", "id", "condition",
    "after", "repeat", "delay", "if", "else", "for", "run", "check", "assert", "js",
    "print", "set", "var", "const", "let", "data", "http", "ws", "match", "port",
    "certificates", "preset", "file", "omit", "operation", "operationname",
    "internal", "external", "all", "fails", "none", "status", "duration", "details",
    "header", "stage", "tests", "binary", "urlencoded", "xmle", "xml", "text", "json",
    "grant", "token_url", "client_id", "client_secret", "scope", "username", "password",
    "token", "value", "loadtest", "server", "doc", "suite", "api", "test", "env",
    "ramp", "concurrency", "duration_limit", "targets", "endpoint", "endpoints",
    "response", "request", "tls", "clients", "server_ca", "version", "annotation",
    "annotations", "tryit", "source", "sources", "group", "alias", "paths",
}

FIELD_LIST_KEYS = {
    "type", "title", "description", "tags", "url", "method", "body", "format",
    "expect", "call", "import", "steps", "outputs", "inputs", "headers", "query",
    "cookies", "setenv", "report", "debug", "items", "protocol", "timeout", "cache",
    "name", "variables", "presets", "setting", "stages", "then", "servers", "export",
    "environment", "examples", "auth", "graphql", "grpc", "flow", "id", "condition",
    "after", "repeat", "delay", "check", "assert", "js", "print", "setenv", "data",
    "certificates", "preset", "file", "omit", "operation", "operationname",
    "status", "duration", "details", "header", "stage", "tests",
}

KEY_PATTERN = "|".join(re.escape(k) for k in sorted(YAML_KEYS, key=len, reverse=True))
KEY_COLON_RE = re.compile(rf"(?<![`/\w])(?P<key>{KEY_PATTERN}):(?=\s|$|[,)])")


def split_fenced_code(text: str) -> list[tuple[str, bool]]:
    parts: list[tuple[str, bool]] = []
    pos = 0
    fence_re = re.compile(r"```[\s\S]*?```")
    for match in fence_re.finditer(text):
        if match.start() > pos:
            parts.append((text[pos : match.start()], False))
        parts.append((match.group(0), True))
        pos = match.end()
    if pos < len(text):
        parts.append((text[pos:], False))
    return parts


def split_inline_code(text: str) -> list[tuple[str, bool]]:
    parts: list[tuple[str, bool]] = []
    pos = 0
    inline_re = re.compile(r"`[^`\n]+`")
    for match in inline_re.finditer(text):
        if match.start() > pos:
            parts.append((text[pos : match.start()], False))
        parts.append((match.group(0), True))
        pos = match.end()
    if pos < len(text):
        parts.append((text[pos:], False))
    return parts


def backtick_key_colon(text: str) -> str:
    return KEY_COLON_RE.sub(lambda m: f"`{m.group('key')}:`", text)


def backtick_list_item_keys(text: str) -> str:
    lines = []
    list_re = re.compile(r"^(\s*-\s+)([a-z][a-z0-9_]*):(?=\s|$)")
    for line in text.splitlines(keepends=True):
        m = list_re.match(line)
        if m and m.group(2) in YAML_KEYS:
            key = m.group(2)
            rest = line[m.end(0) :]
            if not rest.startswith("`"):
                line = f"{m.group(1)}`{key}:`{rest}"
        lines.append(line)
    return "".join(lines)


def backtick_section_headings(text: str) -> str:
    lines = []
    heading_re = re.compile(r"^(#{2,3})\s+([a-z][a-z0-9_]*)\s*$")
    for line in text.splitlines(keepends=True):
        stripped = line.rstrip("\n")
        m = heading_re.match(stripped)
        if m and m.group(2) in YAML_KEYS:
            newline = "\n" if line.endswith("\n") else ""
            line = f"{m.group(1)} `{m.group(2)}`{newline}"
        lines.append(line)
    return "".join(lines)


def backtick_field_table_rows(text: str) -> str:
    lines = []
    in_field_table = False
    field_header_re = re.compile(r"^\|\s*Field\s*\|", re.I)
    table_row_re = re.compile(r"^(\|\s*)\*\*([^*|]+)\*\*(\s*\|)")
    yaml_ref_re = re.compile(rf"`(?:{KEY_PATTERN}):`")

    for line in text.splitlines(keepends=True):
        stripped = line.strip()
        if field_header_re.match(stripped):
            in_field_table = True
            lines.append(line)
            continue
        if in_field_table:
            if not stripped.startswith("|"):
                in_field_table = False
            else:
                m = table_row_re.match(line)
                if m:
                    key = m.group(2).strip().lower()
                    if key in YAML_KEYS:
                        line = f"{m.group(1)}`{key}`{m.group(3)}{line[m.end():]}"
                lines.append(line)
                continue
        # Control tables that reference yaml keys in description column
        m = table_row_re.match(line)
        if m and yaml_ref_re.search(line):
            key = m.group(2).strip().lower()
            if key in YAML_KEYS:
                line = f"{m.group(1)}`{key}`{m.group(3)}{line[m.end():]}"
        lines.append(line)
    return "".join(lines)


def backtick_interface_bullets(text: str) -> str:
    lines = []
    bullet_re = re.compile(r"^(\s*-\s+)\*\*([^*]+)\*\*(\s*[—–-]\s*)")
    edit_labels = {
        "protocol", "url", "method", "timeout", "body", "auth", "format",
        "headers", "query", "cookies",
    }
    for line in text.splitlines(keepends=True):
        m = bullet_re.match(line)
        if m:
            key = m.group(2).strip().lower()
            if key in edit_labels:
                line = f"{m.group(1)}`{key}`{m.group(3)}{line[m.end():]}"
        lines.append(line)
    return "".join(lines)


def backtick_overview_field_lists(text: str) -> str:
    list_re = re.compile(
        rf"\b((?:{KEY_PATTERN})(?:,\s+(?:{KEY_PATTERN}))+)\b"
    )

    def repl(match: re.Match[str]) -> str:
        segment = match.group(1)
        if "`" in segment:
            return segment
        parts = re.split(r"(,\s+)", segment)
        out = []
        for part in parts:
            key = part.strip().lower()
            out.append(f"`{key}`" if key in FIELD_LIST_KEYS else part)
        return "".join(out)

    lines = []
    for line in text.splitlines(keepends=True):
        if re.search(
            r"(Title, tags|Protocol, URL|request/response format|documentation fields|What you edit)",
            line,
            re.I,
        ):
            line = list_re.sub(repl, line)
        lines.append(line)
    return "".join(lines)


def backtick_trailing_field_mentions(text: str) -> str:
    pattern = re.compile(
        rf"(?<=[—–] )((?:{KEY_PATTERN})(?:,\s+(?:{KEY_PATTERN}))+)(?=\s*$)"
    )

    def repl(match: re.Match[str]) -> str:
        parts = re.split(r"(,\s+)", match.group(1))
        out = []
        for part in parts:
            key = part.strip().lower()
            out.append(f"`{key}`" if key in FIELD_LIST_KEYS else part)
        return "".join(out)

    lines = []
    for line in text.splitlines(keepends=True):
        line = pattern.sub(repl, line)
        lines.append(line)
    return "".join(lines)


def backtick_outputs_bullets(text: str) -> str:
    """Lines like '- **Body**: `body[/pattern/]`'."""
    lines = []
    bullet_re = re.compile(r"^(\s*-\s+)\*\*([A-Za-z]+)\*\*:\s*")
    for line in text.splitlines(keepends=True):
        m = bullet_re.match(line)
        if m:
            key = m.group(2).strip().lower()
            if key in YAML_KEYS:
                line = f"{m.group(1)}`{key}`: {line[m.end():]}"
        lines.append(line)
    return "".join(lines)


def process_prose(text: str) -> str:
    text = backtick_list_item_keys(text)
    text = backtick_section_headings(text)
    text = backtick_field_table_rows(text)
    text = backtick_interface_bullets(text)
    text = backtick_overview_field_lists(text)
    text = backtick_trailing_field_mentions(text)
    text = backtick_outputs_bullets(text)
    out = []
    for segment, is_code in split_inline_code(text):
        out.append(segment if is_code else backtick_key_colon(segment))
    return "".join(out)


def process_markdown(content: str) -> str:
    out = []
    for segment, is_code in split_fenced_code(content):
        out.append(segment if is_code else process_prose(segment))
    return "".join(out)


def main() -> int:
    roots = [DOCS_ROOT]
    if len(sys.argv) > 1:
        roots = [Path(p) for p in sys.argv[1:]]

    changed = 0
    for root in roots:
        for path in sorted(root.rglob("*.md")):
            original = path.read_text(encoding="utf-8")
            updated = process_markdown(original)
            if updated != original:
                path.write_text(updated, encoding="utf-8")
                changed += 1
                print(path.relative_to(DOCS_ROOT.parent))
    print(f"Updated {changed} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
