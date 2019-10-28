import { partialMock, quickEvent } from './common/util';

export function createMockedMonacoLanguageApi(): typeof monaco.languages {
  const languageRegistry: Map<string, monaco.languages.ILanguageExtensionPoint> = new Map();
  const mockedMonacoEditorApi: Partial<typeof monaco.languages> = {
    onLanguage: (languageId, callback) => {
      const timerId = setTimeout(() => {
        callback();
      }, 2000);
      return {
        dispose: () => clearTimeout(timerId),
      };
    },
    register: (language) => {
      languageRegistry.set(language.id, language);
    },
    getEncodedLanguageId: (language) => {
      return 23;
    },
    getLanguages: () => {
      const languages: monaco.languages.ILanguageExtensionPoint[] = [];
      for (const value of languageRegistry.values()) {
        languages.push(value);
      }
      return languages;
    },
  };

  return partialMock('monaco.editor', mockedMonacoEditorApi);
}
