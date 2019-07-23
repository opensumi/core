/**
 * API OWENR: 墨蛰
 */

declare module 'vscode' {
	export namespace extensions {
		/**
		 * An event which fires when `extensions.all` changes. This can happen when extensions are
		 * installed, uninstalled, enabled or disabled.
		 */
		export const onDidChange: Event<void>;
	}
}