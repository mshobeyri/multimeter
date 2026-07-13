import * as YAML from 'yaml';

function isDescriptionKey(node: any): boolean {
  return node?.type === 'PLAIN' && node.value === 'description';
}

function literalValueFromMultilinePlainSource(
    yamlString: string,
    range: readonly [number, number, number],
): string {
  const slice = yamlString.slice(range[0], range[1]);
  const lines = slice.split('\n');
  if (lines.length <= 1) {
    return lines[0] ?? '';
  }
  const parts = [lines[0]];
  for (let i = 1; i < lines.length; i++) {
    parts.push(lines[i].trimStart());
  }
  return parts.join('\n');
}

function isMultilinePlainDescriptionValue(
    yamlString: string,
    valueNode: any,
): boolean {
  if (!valueNode || valueNode.type !== YAML.Scalar.PLAIN || !valueNode.range) {
    return false;
  }
  return yamlString.slice(valueNode.range[0], valueNode.range[1]).includes('\n');
}

export function preserveMultilineDescriptionScalars(
    node: any,
    yamlString: string,
): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  if (Array.isArray(node.items)) {
    for (const item of node.items) {
      if (item && typeof item === 'object' &&
          Object.prototype.hasOwnProperty.call(item, 'key') &&
          Object.prototype.hasOwnProperty.call(item, 'value')) {
        if (isDescriptionKey(item.key) &&
            isMultilinePlainDescriptionValue(yamlString, item.value)) {
          item.value.value = literalValueFromMultilinePlainSource(
              yamlString,
              item.value.range,
          );
        }
        preserveMultilineDescriptionScalars(item.key, yamlString);
        preserveMultilineDescriptionScalars(item.value, yamlString);
      } else {
        preserveMultilineDescriptionScalars(item, yamlString);
      }
    }
    return;
  }

  if (Object.prototype.hasOwnProperty.call(node, 'key')) {
    preserveMultilineDescriptionScalars(node.key, yamlString);
  }
  if (Object.prototype.hasOwnProperty.call(node, 'value')) {
    preserveMultilineDescriptionScalars(node.value, yamlString);
  }
}

export function applyDescriptionBlockLiteralStyles(node: any): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  const hasScalarValue = Object.prototype.hasOwnProperty.call(node, 'value') &&
    typeof node.value === 'string';
  if (hasScalarValue && node.value.includes('\n')) {
    node.type = YAML.Scalar.BLOCK_LITERAL;
    node.chomping = 'CLIP';
    return;
  }

  if (Array.isArray(node.items)) {
    for (const item of node.items) {
      if (item && typeof item === 'object' &&
          Object.prototype.hasOwnProperty.call(item, 'key') &&
          Object.prototype.hasOwnProperty.call(item, 'value')) {
        if (isDescriptionKey(item.key) &&
            typeof item.value?.value === 'string' &&
            item.value.value.includes('\n')) {
          item.value.type = YAML.Scalar.BLOCK_LITERAL;
          item.value.chomping = 'CLIP';
        } else {
          applyDescriptionBlockLiteralStyles(item.value);
        }
        applyDescriptionBlockLiteralStyles(item.key);
      } else {
        applyDescriptionBlockLiteralStyles(item);
      }
    }
    return;
  }

  if (Object.prototype.hasOwnProperty.call(node, 'key')) {
    applyDescriptionBlockLiteralStyles(node.key);
  }
  if (Object.prototype.hasOwnProperty.call(node, 'value')) {
    applyDescriptionBlockLiteralStyles(node.value);
  }
}
