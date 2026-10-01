import {
  focusKvField,
  handleKvEditorTab,
  KV_FIELD_ATTR,
  kvFieldId,
  moveKvFieldFocus,
} from './kvFieldNav';

describe('kvFieldNav', () => {
  function mountFields(ids: string[]): HTMLDivElement {
    const root = document.createElement('div');
    for (const id of ids) {
      const input = document.createElement('input');
      input.setAttribute(KV_FIELD_ATTR, id);
      root.appendChild(input);
    }
    document.body.appendChild(root);
    return root;
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('builds key/value field ids', () => {
    expect(kvFieldId(0, 'key')).toBe('key-0');
    expect(kvFieldId(2, 'value')).toBe('value-2');
  });

  it('focuses a field by row and role', () => {
    const root = mountFields(['key-0', 'value-0', 'key-1']);
    expect(focusKvField(root, 0, 'value')).toBe(true);
    expect(document.activeElement).toBe(
      root.querySelector(`[${KV_FIELD_ATTR}="value-0"]`),
    );
  });

  it('Tab from key goes to that row value', () => {
    const root = mountFields(['key-0', 'value-0', 'key-1']);
    const key0 = root.querySelector(`[${KV_FIELD_ATTR}="key-0"]`) as HTMLElement;
    key0.focus();
    const e = {
      key: 'Tab',
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      preventDefault: jest.fn(),
    };
    expect(handleKvEditorTab(e, root)).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(
      root.querySelector(`[${KV_FIELD_ATTR}="value-0"]`),
    );
  });

  it('Tab from value goes to next key', () => {
    const root = mountFields(['key-0', 'value-0', 'key-1']);
    const value0 = root.querySelector(
      `[${KV_FIELD_ATTR}="value-0"]`,
    ) as HTMLElement;
    value0.focus();
    const e = {
      key: 'Tab',
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      preventDefault: jest.fn(),
    };
    expect(handleKvEditorTab(e, root)).toBe(true);
    expect(document.activeElement).toBe(
      root.querySelector(`[${KV_FIELD_ATTR}="key-1"]`),
    );
  });

  it('Shift+Tab moves backward', () => {
    const root = mountFields(['key-0', 'value-0', 'key-1']);
    const key1 = root.querySelector(`[${KV_FIELD_ATTR}="key-1"]`) as HTMLElement;
    expect(moveKvFieldFocus(root, key1, true)).toBe(true);
    expect(document.activeElement).toBe(
      root.querySelector(`[${KV_FIELD_ATTR}="value-0"]`),
    );
  });
});
