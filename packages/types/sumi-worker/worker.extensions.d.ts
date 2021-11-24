declare module 'sumi-worker' {
  /**
   * Namespace for dealing with installed extensions. Extensions are represented
   * by an [extension](#Extension)-interface which enables reflection on them.
   *
   * Extension writers can provide APIs to other extensions by returning their API public
   * surface from the `activate`-call.
   *
   * ```javascript
   * export function activate(context: vscode.ExtensionContext) {
   * 	let api = {
   * 		sum(a, b) {
   * 			return a + b;
   * 		},
   * 		mul(a, b) {
   * 			return a * b;
   * 		}
   * 	};
   * 	// 'export' public api-surface
   * 	return api;
   * }
   * ```
   * When depending on the API of another extension add an `extensionDependency`-entry
   * to `package.json`, and use the [getExtension](#extensions.getExtension)-function
   * and the [exports](#Extension.exports)-property, like below:
   *
   * ```javascript
   * let mathExt = extensions.getExtension('genius.math');
   * let importedApi = mathExt.exports;
   *
   * console.log(importedApi.mul(42, 1));
   * ```
   */
  export namespace extensions {

    /**
     * Get an extension by its full identifier in the form of: `publisher.name`.
     *
     * @param extensionId An extension identifier.
     * @return An extension or `undefined`.
     */
    export function getExtension(extensionId: string): Extension<any> | undefined;

    /**
     * Get an extension its full identifier in the form of: `publisher.name`.
     *
     * @param extensionId An extension identifier.
     * @return An extension or `undefined`.
     */
    export function getExtension<T>(extensionId: string): Extension<T> | undefined;

    /**
     * All extensions currently known to the system.
     */
    export const all: ReadonlyArray<Extension<any>>;

    /**
     * An event which fires when `extensions.all` changes. This can happen when extensions are
     * installed, uninstalled, enabled or disabled.
     */
    export const onDidChange: Event<void>;
  }
}
