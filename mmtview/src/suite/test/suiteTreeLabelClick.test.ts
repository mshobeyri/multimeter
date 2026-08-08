import {
  handleSuiteFileLabelActivate,
  isOpenFileModifier,
  suiteFileLabelTitle,
} from './suiteTreeLabelClick';

describe('suiteTreeLabelClick', () => {
  it('treats ctrl and meta as open-file modifiers', () => {
    expect(isOpenFileModifier({ ctrlKey: true, metaKey: false })).toBe(true);
    expect(isOpenFileModifier({ ctrlKey: false, metaKey: true })).toBe(true);
    expect(isOpenFileModifier({ ctrlKey: false, metaKey: false })).toBe(false);
  });

  it('expands on plain activate and opens on modifier', () => {
    const toggleExpanded = jest.fn();
    const openRelativeFile = jest.fn();
    const event = { preventDefault: jest.fn(), stopPropagation: jest.fn() };

    handleSuiteFileLabelActivate({
      event,
      isMissing: false,
      path: 'a.mmt',
      openFile: false,
      toggleExpanded,
      openRelativeFile,
    });
    expect(toggleExpanded).toHaveBeenCalledTimes(1);
    expect(openRelativeFile).not.toHaveBeenCalled();

    handleSuiteFileLabelActivate({
      event,
      isMissing: false,
      path: 'a.mmt',
      openFile: true,
      toggleExpanded,
      openRelativeFile,
    });
    expect(openRelativeFile).toHaveBeenCalledWith('a.mmt');
    expect(suiteFileLabelTitle('a.mmt')).toContain('Ctrl/Cmd+click');
  });

  it('ignores missing files', () => {
    const toggleExpanded = jest.fn();
    const openRelativeFile = jest.fn();
    handleSuiteFileLabelActivate({
      event: { preventDefault: jest.fn(), stopPropagation: jest.fn() },
      isMissing: true,
      path: 'missing.mmt',
      openFile: true,
      toggleExpanded,
      openRelativeFile,
    });
    expect(toggleExpanded).not.toHaveBeenCalled();
    expect(openRelativeFile).not.toHaveBeenCalled();
  });
});
