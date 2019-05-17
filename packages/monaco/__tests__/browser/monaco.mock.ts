export namespace MonacoMock {

  export namespace editor {
    
      export function create(element: any, options: any) {
        return {element, options};
      }

      export function setTheme() {
        return null;
      }

      export function defineTheme() {
        return null;
      }

  }

  export namespace languages {
    
    export function register() {

    }

    export function setLanguageConfiguration()  {

    }

    export function setTokensProvider() {
      
    }
  }

}