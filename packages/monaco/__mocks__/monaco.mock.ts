// tslint:disable-next-line
export namespace MonacoMock {

  export namespace editor {

    export function create(element: any, options: any) {
      return new EditorMock(element, options);
    }

    export function setTheme() {
      return null;
    }

    export function defineTheme() {
      return null;
    }

    export function createModel(value: string, languageId: string) {

    }

    export function layout() {

    }

  }

  export namespace languages {

    const _languages: any[] = [];

    export function register(language: any) {
      _languages.push(language);
    }

    export function setLanguageConfiguration() {

    }

    export function setTokensProvider() {

    }

    export function getLanguages() {
      return _languages;
    }

    export function onLanguage() {

    }
  }

  export namespace services {
    export function CodeEditorServiceImpl() {

    }

    export const StaticServices = {
      standaloneThemeService: {
        get() {

        },
      },
    };
  }

}

class EditorMock {

  model: any;

  constructor(element: any, options: any) {

  }

  setModel(model: any) {
    this.model = model;
  }

  layout() {

  }

  onDidChangeModel() {

  }

}
