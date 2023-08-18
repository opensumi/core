declare module 'vscode' {
  /**
   * Represents the validation type of the Source Control input.
   */
  export enum SourceControlInputBoxValidationType {

    /**
     * Something not allowed by the rules of a language or other means.
     */
    Error = 0,

    /**
     * Something suspicious but allowed.
     */
    Warning = 1,

    /**
     * Something to inform about but not a problem.
     */
    Information = 2
  }

  export interface SourceControlInputBoxValidation {

    /**
     * The validation message to display.
     */
    readonly message: string | MarkdownString;

    /**
     * The validation type.
     */
    readonly type: SourceControlInputBoxValidationType;
  }

  /**
   * Represents the input box in the Source Control viewlet.
   */
  export interface SourceControlInputBox {
    /**
     * A validation function for the input box. It's possible to change
     * the validation provider simply by setting this property to a different function.
     */
    validateInput?(value: string, cursorPosition: number): ProviderResult<SourceControlInputBoxValidation>;
  }
}
