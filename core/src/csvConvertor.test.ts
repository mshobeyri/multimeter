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

  it('preserves quoted numeric strings without coercing to number',
     async () => {
       const csv = `id,code,value\n1,"0222",100\n2,"007",200\n`;
       const code = await csvToJSObj(csv, 'items');
       const items = new Function(code + '\nreturn items;')();
       expect(items).toHaveLength(2);
       expect(items[0]).toEqual({id: 1, code: '0222', value: 100});
       expect(items[1]).toEqual({id: 2, code: '007', value: 200});
     });

  it('preserves quoted boolean strings without coercing to boolean',
     async () => {
       const csv = `name,flag,label\nalice,true,"true"\nbob,false,"false"\n`;
       const code = await csvToJSObj(csv, 'data');
       const data = new Function(code + '\nreturn data;')();
       expect(data).toHaveLength(2);
       expect(data[0]).toEqual({name: 'alice', flag: true, label: 'true'});
       expect(data[1]).toEqual({name: 'bob', flag: false, label: 'false'});
     });

  it('handles mixed quoted and unquoted values in a row', async () => {
    const csv =
        `name,family,age\nmehrdad,shobeyri,35\nsahar,ghazeydi,34\n"0222","true",12\n`;
    const code = await csvToJSObj(csv, 'users');
    const users = new Function(code + '\nreturn users;')();
    expect(users).toHaveLength(3);
    expect(users[0]).toEqual({name: 'mehrdad', family: 'shobeyri', age: 35});
    expect(users[1]).toEqual({name: 'sahar', family: 'ghazeydi', age: 34});
    expect(users[2]).toEqual({name: '0222', family: 'true', age: 12});
  });

  it('coerces unquoted numbers and booleans normally', async () => {
    const csv = `val,flag\n42,true\n3.14,FALSE\n`;
    const code = await csvToJSObj(csv, 'rows');
    const rows = new Function(code + '\nreturn rows;')();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({val: 42, flag: true});
    expect(rows[1]).toEqual({val: 3.14, flag: false});
  });
});
