import { isEditorOption, getConvertedMonacoOptions } from '@ali/ide-editor/lib/browser/preference/converter';

describe('editor Options Converter Tests', () => {

  const preferences: Map<string, any> = new Map();

  const mockedPreferenceService: any = {
    get: (k) => {
      return preferences.get(k);
    },
    set: (k, v) => {
      preferences.set(k, v);
    },
  };

  beforeEach(() => {
    preferences.clear();
  });

  it('should be able to get all preference settings', () => {
    mockedPreferenceService.set('editor.fontSize', 1000);
    mockedPreferenceService.set('editor.minimap', true);
    mockedPreferenceService.set('editor.tabSize', 100);
    mockedPreferenceService.set('editor.enableSplitViewResizing', true);
    const options = getConvertedMonacoOptions(mockedPreferenceService);
    expect(options.editorOptions.fontSize).toBe(1000);
    expect(options.editorOptions.minimap).toMatchObject({
      enabled: true,
    });
    expect(options.modelOptions.tabSize).toBe(100);
    expect(options.diffOptions.enableSplitViewResizing).toBe(true);
  });

  it('should be able to filter preference settings by updating params', () => {
    mockedPreferenceService.set('editor.fontSize', 1000);
    mockedPreferenceService.set('editor.tabSize', 100);
    mockedPreferenceService.set('editor.enableSplitViewResizing', true);
    const options = getConvertedMonacoOptions(mockedPreferenceService, undefined, undefined, ['editor.fontSize']);
    expect(options.editorOptions.fontSize).toBe(1000);
    expect(options.modelOptions.tabSize).toBeUndefined();
    expect(options.diffOptions.enableSplitViewResizing).toBeUndefined();
  });

  it('isEditorOptions works fine', () => {
    expect(isEditorOption('app.confirmOnExit')).toBe(false);
    expect(isEditorOption('editor.fontSize')).toBe(true);
    expect(isEditorOption('editor.tabSize')).toBe(true);
    expect(isEditorOption('editor.enableSplitViewResizing')).toBe(true);
  });

});
