declare module 'vscode' {
	// https://github.com/microsoft/vscode/issues/55718
	/**
	 * An {@link Event} which fires when a {@link Terminal}'s dimensions change.
	 */
	export interface TerminalDimensionsChangeEvent {
		/**
		 * The {@link Terminal} for which the dimensions have changed.
		 */
		readonly terminal: Terminal;
		/**
		 * The new value for the {@link Terminal.dimensions terminal's dimensions}.
		 */
		readonly dimensions: TerminalDimensions;
	}
}
