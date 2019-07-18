declare module 'vscode' {
  export namespace window {

		/**
		 * Creates a [Terminal](#Terminal). The cwd of the terminal will be the workspace directory
		 * if it exists, regardless of whether an explicit customStartPath setting exists.
		 *
		 * @param name Optional human-readable string which will be used to represent the terminal in the UI.
		 * @param shellPath Optional path to a custom shell executable to be used in the terminal.
		 * @param shellArgs Optional args for the custom shell executable. A string can be used on Windows only which
		 * allows specifying shell args in [command-line format](https://msdn.microsoft.com/en-au/08dfcab2-eb6e-49a4-80eb-87d4076c98c6).
		 * @return A new Terminal.
		 */
		export function createTerminal(name?: string, shellPath?: string, shellArgs?: string[] | string): Terminal;


  }
}
