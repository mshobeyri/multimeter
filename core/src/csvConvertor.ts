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
  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  };
  const coerce = (v: string): any => {
    const t = (v ?? '').trim();
    if (t === '') {
      return '';
    }
    if (/^\d+(?:\.\d+)?$/.test(t)) {
      return Number(t);
    }
    if (/^(true|false)$/i.test(t)) {
      return t.toLowerCase() === 'true';
    }
    return t;
  };
  const headers = parseCsvLine(lines[0]).map(h => h.trim());
  const rows = lines.slice(1).map(parseCsvLine);
  return rows.filter(r => r.some(c => (c ?? '').trim() !== ''))
      .map(
          cols => Object.fromEntries(
              headers.map((h, i) => [h, coerce(cols[i] ?? '')])));
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
