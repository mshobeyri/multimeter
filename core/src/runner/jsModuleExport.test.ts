import {
  extractTopLevelFunctionNames,
  wrapJsHelperModuleSource,
} from './jsModuleExport';

describe('jsModuleExport', () => {
  test('extracts function declarations and const arrows', () => {
    const src = `
      function greet(name) { return name; }
      async function load() { return 1; }
      const add = (a, b) => a + b;
      let mul = function(a, b) { return a * b; };
      var div = async (a, b) => a / b;
      const notAFn = 42;
      // function ignoredInComment() {}
      const s = "function fake() {}";
    `;
    expect(extractTopLevelFunctionNames(src).sort()).toEqual(
        ['add', 'div', 'greet', 'load', 'mul'].sort());
  });

  test('wrap attaches bare functions onto module.exports', () => {
    const wrapped = wrapJsHelperModuleSource(`
      function add(a, b) { return a + b; }
      const double = (x) => x * 2;
    `);
    const moduleObj: {exports: any} = {exports: {}};
    const fn = new Function('module', '__filename', '__dirname', wrapped);
    const exported = fn(moduleObj, 'x.js', '');
    expect(exported.add(2, 3)).toBe(5);
    expect(exported.double(4)).toBe(8);
  });

  test('wrap keeps explicit module.exports and does not overwrite keys', () => {
    const wrapped = wrapJsHelperModuleSource(`
      function add(a, b) { return a + b; }
      module.exports = {
        add: (a, b) => a * b,
        onlyExport: () => 1,
      };
    `);
    const moduleObj: {exports: any} = {exports: {}};
    const fn = new Function('module', '__filename', '__dirname', wrapped);
    const exported = fn(moduleObj, 'x.js', '');
    expect(exported.add(2, 3)).toBe(6);
    expect(exported.onlyExport()).toBe(1);
  });

  test('wrap merges bare functions into existing exports object', () => {
    const wrapped = wrapJsHelperModuleSource(`
      function add(a, b) { return a + b; }
      module.exports = { scale: (x) => x * 10 };
    `);
    const moduleObj: {exports: any} = {exports: {}};
    const fn = new Function('module', '__filename', '__dirname', wrapped);
    const exported = fn(moduleObj, 'x.js', '');
    expect(exported.add(2, 3)).toBe(5);
    expect(exported.scale(2)).toBe(20);
  });

  test('wrap skips auto-attach when there are no top-level functions', () => {
    const wrapped = wrapJsHelperModuleSource('const n = 1;');
    const moduleObj: {exports: any} = {exports: {keep: true}};
    const fn = new Function('module', '__filename', '__dirname', wrapped);
    expect(fn(moduleObj, 'x.js', '')).toEqual({keep: true});
  });

  test('stripJsCommentsAndStrings ignores names in comments strings and templates', () => {
    const src = [
      '/* function hidden() {} */',
      'const s = "function fake() {}";',
      'const t = `function alsoFake() {}`;',
      'const escaped = "say \\"hi\\"";',
      'function real() { return 1; }',
    ].join('\n');
    expect(extractTopLevelFunctionNames(src)).toEqual(['real']);
  });

  test('wrap does not rewrite module.exports when it is a function', () => {
    const wrapped = wrapJsHelperModuleSource(`
      function add(a, b) { return a + b; }
      module.exports = function main() { return 9; };
    `);
    const moduleObj: {exports: any} = {exports: {}};
    const fn = new Function('module', '__filename', '__dirname', wrapped);
    const exported = fn(moduleObj, 'x.js', '');
    expect(typeof exported).toBe('function');
    expect(exported()).toBe(9);
  });
});
