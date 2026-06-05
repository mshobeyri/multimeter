#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const errors = [];
const warnings = [];
const pluginNamePattern = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;

function addError(message) {
  errors.push(message);
}

function addWarning(message) {
  warnings.push(message);
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile(filePath, context) {
  let raw;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch {
    addError(`${context} is missing: ${filePath}`);
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    addError(`${context} contains invalid JSON (${filePath}): ${error.message}`);
    return null;
  }
}

function parseFrontmatter(content) {
  const normalized = content.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return null;
  }

  const closingIndex = normalized.indexOf("\n---\n", 4);
  if (closingIndex === -1) {
    return null;
  }

  const fields = {};
  const frontmatterBlock = normalized.slice(4, closingIndex);
  for (const line of frontmatterBlock.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }
    fields[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return fields;
}

async function walkFiles(dirPath) {
  const files = [];
  const stack = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
      } else if (entry.isFile()) {
        files.push(entryPath);
      }
    }
  }
  return files;
}

function isSafeRelativePath(value) {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return true;
  }
  if (path.isAbsolute(value)) {
    return false;
  }
  const normalized = path.posix.normalize(value.replace(/\\/g, "/"));
  return !normalized.startsWith("../") && normalized !== "..";
}

async function validateReferencedPath(pluginDir, fieldName, pathValue, pluginName) {
  if (pathValue.startsWith("http://") || pathValue.startsWith("https://")) {
    return;
  }
  if (!isSafeRelativePath(pathValue)) {
    addError(`${pluginName}: field "${fieldName}" has invalid path "${pathValue}".`);
    return;
  }

  const resolved = path.resolve(pluginDir, pathValue);
  if (!(await pathExists(resolved))) {
    addError(`${pluginName}: field "${fieldName}" references missing path "${pathValue}".`);
  }
}

function extractPathValues(value) {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractPathValues(entry));
  }
  if (value && typeof value === "object") {
    return [value.path, value.file].filter((entry) => typeof entry === "string");
  }
  return [];
}

async function validateFrontmatterFile(filePath, componentName, requiredKeys, pluginName) {
  const content = await fs.readFile(filePath, "utf8");
  const parsed = parseFrontmatter(content);
  const relativeFile = path.relative(repoRoot, filePath);

  if (!parsed) {
    addError(`${pluginName}: ${componentName} file missing YAML frontmatter: ${relativeFile}`);
    return;
  }

  for (const key of requiredKeys) {
    if (!parsed[key] || parsed[key].length === 0) {
      addError(`${pluginName}: ${componentName} file missing "${key}" in frontmatter: ${relativeFile}`);
    }
  }
}

async function validateComponentFrontmatter(pluginDir, pluginName) {
  const componentChecks = [
    { dir: "rules", component: "rule", keys: ["description"], names: [".md", ".mdc", ".markdown"] },
    { dir: "agents", component: "agent", keys: ["name", "description"], names: [".md", ".mdc", ".markdown"] },
    { dir: "commands", component: "command", keys: ["name", "description"], names: [".md", ".mdc", ".markdown", ".txt"] },
  ];

  for (const check of componentChecks) {
    const dirPath = path.join(pluginDir, check.dir);
    if (!(await pathExists(dirPath))) {
      continue;
    }
    for (const file of await walkFiles(dirPath)) {
      if (check.names.includes(path.extname(file).toLowerCase())) {
        await validateFrontmatterFile(file, check.component, check.keys, pluginName);
      }
    }
  }

  const skillsDir = path.join(pluginDir, "skills");
  if (await pathExists(skillsDir)) {
    for (const file of await walkFiles(skillsDir)) {
      if (path.basename(file) === "SKILL.md") {
        await validateFrontmatterFile(file, "skill", ["name", "description"], pluginName);
      }
    }
  }
}

async function validateSinglePlugin(pluginDir) {
  const manifestPath = path.join(pluginDir, ".cursor-plugin", "plugin.json");
  const manifest = await readJsonFile(manifestPath, "Cursor plugin manifest");
  if (!manifest) {
    return;
  }

  const pluginName = manifest.name ?? "unknown-plugin";
  if (typeof manifest.name !== "string" || !pluginNamePattern.test(manifest.name)) {
    addError('"name" in .cursor-plugin/plugin.json must be lowercase and use only alphanumerics, hyphens, and periods.');
  }
  for (const field of ["displayName", "version", "description"]) {
    if (typeof manifest[field] !== "string" || manifest[field].length === 0) {
      addError(`"${field}" is required in .cursor-plugin/plugin.json.`);
    }
  }
  if (!manifest.author || typeof manifest.author.name !== "string" || manifest.author.name.length === 0) {
    addError('"author.name" is required in .cursor-plugin/plugin.json.');
  }

  for (const field of ["logo", "rules", "skills", "agents", "commands", "hooks", "mcpServers"]) {
    for (const value of extractPathValues(manifest[field])) {
      await validateReferencedPath(pluginDir, field, value, pluginName);
    }
  }

  await validateComponentFrontmatter(pluginDir, pluginName);

  if (!(await pathExists(path.join(pluginDir, "rules"))) && !(await pathExists(path.join(pluginDir, "skills")))) {
    addWarning(`${pluginName}: no rules/ or skills/ directory found.`);
  }
}

function summarizeAndExit() {
  if (warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
    console.log("");
  }

  if (errors.length > 0) {
    console.error("Validation failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("Cursor plugin validation passed.");
}

await validateSinglePlugin(repoRoot);
summarizeAndExit();
