import { isEditorOption, getConvertedMonacoOptions } from '@ali/ide-editor/lib/browser/preference/converter';

describe('editor Options Converter Tests', () => {

  const preferences: Map<string, any> = new Map();

  const mockConfigurationService: any = {
    getValue: (k) => {
      return preferences.get(k);
    },
    setValue: (k, v) => {
      preferences.set(k, v);
    },
  };

  beforeEach(() => {
    preferences.clear();
  });

  it('should be able to get all preference settings', () => {
    mockConfigurationService.setValue('editor.fontSize', 1000);
    mockConfigurationService.setValue('editor.minimap', true);
    mockConfigurationService.setValue('editor.tabSize', 100);
    mockConfigurationService.setValue('diffEditor.enableSplitViewResizing', true);

    const options = getConvertedMonacoOptions(mockConfigurationService);
    expect(options.editorOptions.fontSize).toBe(1000);
    expect(options.editorOptions.minimap).toMatchObject({
      enabled: true,
    });
    expect(options.modelOptions.tabSize).toBe(100);
    expect(options.diffOptions.enableSplitViewResizing).toBe(true);
  });

  it('should be able to filter preference settings by updating params', () => {
    mockConfigurationService.setValue('editor.fontSize', 1000);
    mockConfigurationService.setValue('editor.tabSize', 100);
    mockConfigurationService.setValue('diffEditor.enableSplitViewResizing', true);
    const options = getConvertedMonacoOptions(mockConfigurationService, undefined, undefined, ['editor.fontSize']);
    expect(options.editorOptions.fontSize).toBe(1000);
    expect(options.modelOptions.tabSize).toBeUndefined();
    expect(options.diffOptions.enableSplitViewResizing).toBeUndefined();
  });

  it('isEditorOptions works fine', () => {
    expect(isEditorOption('app.confirmOnExit')).toBe(false);
    expect(isEditorOption('editor.fontSize')).toBe(true);
    expect(isEditorOption('editor.tabSize')).toBe(true);
    expect(isEditorOption('diffEditor.enableSplitViewResizing')).toBe(true);
  });

});
