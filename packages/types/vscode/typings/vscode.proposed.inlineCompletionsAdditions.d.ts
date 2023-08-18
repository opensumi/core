declare module 'vscode' {
	// https://github.com/microsoft/vscode/issues/124024 @hediet @alexdima
	export interface InlineCompletionItem {
		/**
		 * If set to `true`, unopened closing brackets are removed and unclosed opening brackets are closed.
		 * Defaults to `false`.
		*/
		completeBracketPairs?: boolean;
	}

	export interface InlineCompletionItemProvider {
		// eslint-disable-next-line local/vscode-dts-provider-naming
		handleDidShowCompletionItem?(completionItem: InlineCompletionItem): void;
	}

	// When finalizing `commands`, make sure to add a corresponding constructor parameter.
	export interface InlineCompletionList {
		/**
		 * A list of commands associated with the inline completions of this list.
		 */
		commands?: Command[];
	}
}
