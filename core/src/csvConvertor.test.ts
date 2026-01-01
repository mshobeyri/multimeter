import {csvToJSObj} from './csvConvertor'

describe('CSV import parsing', () => {
  it('parses simple CSV into array of objects with number coercion',
     async () => {
       const csv = `name,family,age\nmehrdad,shobeyri,35\nsahar,ghazeydi,34\n`;
       const code = await csvToJSObj(csv, 'users');
       const users = new Function(code + '\nreturn users;')();
       expect(Array.isArray(users)).toBe(true);
       expect(users).toHaveLength(2);
       expect(users[0]).toEqual({name: 'mehrdad', family: 'shobeyri', age: 35});
       expect(users[1]).toEqual({name: 'sahar', family: 'ghazeydi', age: 34});
     });

  it('returns empty array when content looks like YAML not CSV', async () => {
    const yamlLike = `type: api\nprotocol: http\n`;
    const code = await csvToJSObj(yamlLike, 'users');
    const users = new Function(code + '\nreturn users;')();
    expect(users).toEqual([]);
  });

  it('parses CSV with BOM and CRLF and quoted commas/quotes', async () => {
    const csv =
        '\uFEFFname,comment\r\n"john","said, ""hello"""\r\n"doe","plain"\n';
    const code = await csvToJSObj(csv, 'rows');
    const rows = new Function(code + '\nreturn rows;')();
    expect(rows).toEqual([
      {name: 'john', comment: 'said, "hello"'}, {name: 'doe', comment: 'plain'}
    ]);
  });
});
