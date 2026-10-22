export const parseCsv = (content: string): Array<Record<string, any>> => {
  let text = (content || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  // Strip BOM if present
  text = text.replace(/^\uFEFF/, '');
  if (!text) {
    return [];
  }
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) {
    return [];
  }
  if (!lines[0].includes(',') && /:\s*/.test(lines[0])) {
    return [];
  }
  const parseCsvLine = (line: string): {value: string; quoted: boolean}[] => {
    const result: {value: string; quoted: boolean}[] = [];
    let current = '';
    let inQuotes = false;
    let fieldQuoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          if (!inQuotes) {
            fieldQuoted = true;
          }
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push({value: current, quoted: fieldQuoted});
        current = '';
        fieldQuoted = false;
      } else {
        current += ch;
      }
    }
    result.push({value: current, quoted: fieldQuoted});
    return result;
  };
  const coerce = (v: string, quoted: boolean): any => {
    const t = (v ?? '').trim();
    if (t === '') {
      return '';
    }
    if (quoted) {
      return t;
    }
    if (/^\d+(?:\.\d+)?$/.test(t)) {
      return Number(t);
    }
    if (/^(true|false)$/i.test(t)) {
      return t.toLowerCase() === 'true';
    }
    return t;
  };
  const headers = parseCsvLine(lines[0]).map(h => h.value.trim());
  const rows = lines.slice(1).map(parseCsvLine);
  return rows.filter(r => r.some(c => (c?.value ?? '').trim() !== ''))
      .map(
          cols => Object.fromEntries(
              headers.map((h, i) => {
                const cell = cols[i];
                return [h, coerce(cell?.value ?? '', cell?.quoted ?? false)];
              })));
};

export const csvToJSObj =
    async(content: string, name: string): Promise<string> => {
  const arr = parseCsv(content);
  if (arr.length === 0 && (content || '').trim()) {
    console.warn(`CSV import for ${
        name} looks invalid (no commas in header). Skipping.`);
  }
  return `const ${name} = ${JSON.stringify(arr)};`;
};
