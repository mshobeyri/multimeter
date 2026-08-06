// Auto-maintained companion to createApiLogHelpers in runApi.ts.
// Embedded literally so pkg binaries can generate API JS (Function#toString
// returns "{ [native code] }" inside pkg snapshots).
//
// When changing createApiLogHelpers, rebuild core then run:
//   node scripts/sync-api-log-helpers-source.mjs

export const CREATE_API_LOG_HELPERS_SOURCE = `function createApiLogHelpers() {
    // This factory's *source* is embedded via CREATE_API_LOG_HELPERS_SOURCE (not
    // Function#toString) because pkg snapshots replace the body with native-code
    // stubs. Keep the baked string in sync with this body
    // (scripts/sync-api-log-helpers-source.mjs). \`runner.test.ts\` guards the
    // inlined omit marker against drifting from OMIT_SENTINEL.
    const omitSentinel = '__MMT_OMIT__';
    function raw(value) {
        return { __mmt_raw: String(value) };
    }
    function isRaw(value) {
        return !!value && typeof value === 'object' &&
            Object.prototype.hasOwnProperty.call(value, '__mmt_raw');
    }
    function isPlainObject(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value) &&
            !isRaw(value);
    }
    function isComplex(value) {
        return Array.isArray(value) || isPlainObject(value);
    }
    function escapeString(value) {
        return String(value).replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"');
    }
    function formatScalar(value) {
        if (isRaw(value)) {
            return value.__mmt_raw;
        }
        if (value === null) {
            return 'null';
        }
        // Unquoted like the YAML keyword, so a missing value reads as \`omit\` while
        // a literal string value still shows as \`"omit"\`.
        if (value === omitSentinel) {
            return 'omit';
        }
        if (typeof value === 'string') {
            return '"' + escapeString(value) + '"';
        }
        if (typeof value === 'number') {
            return Number.isFinite(value) ? String(value) : '"' + String(value) + '"';
        }
        if (typeof value === 'boolean') {
            return value ? 'true' : 'false';
        }
        if (typeof value === 'bigint') {
            return value.toString();
        }
        return '"' + escapeString(String(value)) + '"';
    }
    function formatValue(value, indentLevel) {
        const indent = ' '.repeat(indentLevel);
        if (!isComplex(value)) {
            return indent + formatScalar(value);
        }
        if (Array.isArray(value)) {
            if (!value.length) {
                return indent + '[]';
            }
            const lines = [indent + '['];
            for (const item of value) {
                lines.push(formatValue(item, indentLevel + 2));
            }
            lines.push(indent + ']');
            return lines.join('\\n');
        }
        const keys = Object.keys(value || {});
        if (!keys.length) {
            return indent + '{}';
        }
        const maxKeyLen = Math.max(...keys.map(key => key.length));
        const lines = [indent + '{'];
        for (const key of keys) {
            const nested = value[key];
            const keyIndent = ' '.repeat(indentLevel + 2);
            const prefix = keyIndent + key + ':';
            if (isComplex(nested)) {
                lines.push(prefix);
                lines.push(formatValue(nested, indentLevel + 4));
            }
            else {
                const padding = ' '.repeat(Math.max(0, maxKeyLen - key.length) + 2);
                lines.push(prefix + padding + formatScalar(nested));
            }
        }
        lines.push(indent + '}');
        return lines.join('\\n');
    }
    function formatKeyValueObject(obj, indentLevel = 2) {
        const entries = Object.entries(obj || {});
        const indent = ' '.repeat(indentLevel);
        if (!entries.length) {
            return indent + '{}';
        }
        const maxKeyLen = Math.max(...entries.map(([key]) => key.length));
        return entries
            .map(([key, value]) => {
            const prefix = indent + key + ':';
            if (isComplex(value)) {
                return prefix + '\\n' + formatValue(value, indentLevel + 2);
            }
            const padding = ' '.repeat(Math.max(0, maxKeyLen - key.length) + 2);
            return prefix + padding + formatScalar(value);
        })
            .join('\\n');
    }
    function formatSection(title, obj) {
        return title + '\\n' + formatKeyValueObject(obj);
    }
    function formatDuration(value) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            // Always render as integer milliseconds so the Response log matches
            // the API tester toolbar (e.g. "1234ms", not "1s 234ms").
            const ms = value < 0 ? 0 : Math.round(value);
            return raw(\`\${ms}ms\`);
        }
        return raw('');
    }
    function formatBodyValue(body) {
        if (body === null || body === undefined || body === '') {
            return '';
        }
        if (typeof Buffer !== 'undefined' && Buffer.isBuffer(body)) {
            return \`<binary \${body.length} bytes>\`;
        }
        if (typeof body === 'string') {
            const trimmed = body.trim();
            if (!trimmed) {
                return '';
            }
            try {
                return JSON.parse(trimmed);
            }
            catch (err) {
                return trimmed;
            }
        }
        return body;
    }
    function unwrapForMatch(value) {
        return isRaw(value) ? value.__mmt_raw : value;
    }
    function valuesMatch(actual, expected) {
        const left = unwrapForMatch(actual);
        const right = unwrapForMatch(expected);
        if (Object.is(left, right)) {
            return true;
        }
        if (left === undefined || right === undefined) {
            return false;
        }
        if (left === null || right === null) {
            return left === right;
        }
        if (typeof left === 'object' || typeof right === 'object') {
            try {
                return JSON.stringify(left) === JSON.stringify(right);
            }
            catch {
                return false;
            }
        }
        return String(left) === String(right);
    }
    function displayExpectValue(value) {
        const restoreOmit = (v) => {
            if (v === omitSentinel) {
                return 'omit';
            }
            if (Array.isArray(v)) {
                return v.map(restoreOmit);
            }
            if (v && typeof v === 'object' && !isRaw(v)) {
                const out = {};
                for (const [k, nested] of Object.entries(v)) {
                    out[k] = restoreOmit(nested);
                }
                return out;
            }
            return v;
        };
        const normalized = restoreOmit(unwrapForMatch(value));
        if (normalized === null || normalized === undefined) {
            return String(normalized);
        }
        if (typeof normalized === 'object') {
            try {
                return JSON.stringify(normalized);
            }
            catch {
                return String(normalized);
            }
        }
        return String(normalized);
    }
    function formatExpects(actualOutputs, expectedOutputs, title) {
        const expected = expectedOutputs || {};
        const actual = actualOutputs || {};
        const titleText = typeof title === 'string' && title.trim() ? title.trim() : '';
        const titlePart = titleText ? \`"\${titleText}" - \` : '';
        const successLines = [];
        const failLines = [];
        for (const key of Object.keys(expected)) {
            const expectedDisplay = displayExpectValue(expected[key]);
            const subject = key + ' == ' + expectedDisplay;
            if (valuesMatch(actual[key], expected[key])) {
                successLines.push('\\u2713 Check ' + titlePart + '"' + subject + '"');
            }
            else {
                failLines.push('\\u00D7 Check ' + titlePart + '"' + subject + '" (' +
                    displayExpectValue(actual[key]) + ' == ' + expectedDisplay + ')');
            }
        }
        return { successLines, failLines };
    }
    return {
        raw,
        isRaw,
        isPlainObject,
        isComplex,
        escapeString,
        formatScalar,
        formatValue,
        formatKeyValueObject,
        formatSection,
        formatDuration,
        formatBodyValue,
        valuesMatch,
        formatExpects,
    };
}`;
