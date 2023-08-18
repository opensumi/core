/**
 * This is the place for API experiments and proposals.
 * These API are NOT stable and subject to change. They are only available in the Insiders
 * distribution and CANNOT be used in published extensions.
 *
 * To test these API in local environment:
 * - Use Insiders release of VS Code.
 * - Add `"enableProposedApi": true` to your package.json.
 * - Copy this file to your project.
 */

declare module 'vscode' {
  export interface SourceControl {

    /**
     * Whether the source control is selected.
     */
    readonly selected: boolean;

    /**
     * An event signaling when the selection state changes.
     */
    readonly onDidChangeSelection: Event<boolean>;
  }

  //#endregion

  //#region Joao: SCM Input Box

  /**
   * Represents the input box in the Source Control viewlet.
   */
  export interface SourceControlInputBox {

    /**
      * Controls whether the input box is visible (default is `true`).
      */
    visible: boolean;
  }

  //#region https://github.com/microsoft/vscode/issues/16221

  // todo@API Split between Inlay- and OverlayHints (InlayHint are for a position, OverlayHints for a non-empty range)
  // todo@API add "mini-markdown" for links and styles
  // (done) remove description
  // (done) rename to InlayHint
  // (done)  add InlayHintKind with type, argument, etc

  export namespace languages {
    /**
     * Register a inlay hints provider.
     *
     * Multiple providers can be registered for a language. In that case providers are asked in
     * parallel and the results are merged. A failing provider (rejected promise or exception) will
     * not cause a failure of the whole operation.
     *
     * @param selector A selector that defines the documents this provider is applicable to.
     * @param provider An inlay hints provider.
     * @return A {@link Disposable} that unregisters this provider when being disposed.
     */
    export function registerInlayHintsProvider(selector: DocumentSelector, provider: InlayHintsProvider): Disposable;
  }
}
