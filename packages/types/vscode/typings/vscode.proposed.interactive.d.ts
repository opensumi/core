/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'vscode' {

	export interface InteractiveEditorSlashCommand {
		command: string;
		detail?: string;
		refer?: boolean;
		/**
		 * Whether the command should execute as soon
		 * as it is entered. Defaults to `false`.
		 */
		executeImmediately?: boolean;
		// kind: CompletionItemKind;
	}

	// todo@API make classes
	export interface InteractiveEditorSession {
		placeholder?: string;
		input?: string;
		slashCommands?: InteractiveEditorSlashCommand[];
		wholeRange?: Range;
		message?: string;
	}

	// todo@API make classes
	export interface InteractiveEditorRequest {
		prompt: string;
		selection: Selection;
		wholeRange: Range;
		attempt: number;
		live: boolean;
	}

	// todo@API make classes
	export interface InteractiveEditorResponse {
		edits: TextEdit[] | WorkspaceEdit;
		contents?: MarkdownString;
		placeholder?: string;
		wholeRange?: Range;
	}

	// todo@API make classes
	export interface InteractiveEditorMessageResponse {
		contents: MarkdownString;
		placeholder?: string;
		wholeRange?: Range;
	}

	export interface InteractiveEditorProgressItem {
		message?: string;
		edits?: TextEdit[];
		editsShouldBeInstant?: boolean;
		slashCommand?: InteractiveEditorSlashCommand;
		content?: string | MarkdownString;
	}

	export enum InteractiveEditorResponseFeedbackKind {
		Unhelpful = 0,
		Helpful = 1,
		Undone = 2,
		Accepted = 3,
		Bug = 4
	}

	export interface TextDocumentContext {
		document: TextDocument;
		selection: Selection;
	}

	export interface InteractiveEditorSessionProviderMetadata {
		label?: string;
		supportReportIssue?: boolean;
	}

	export interface InteractiveEditorReplyFollowup {
		message: string;
		tooltip?: string;
		title?: string;
	}

	export interface InteractiveEditorSessionProvider<S extends InteractiveEditorSession = InteractiveEditorSession, R extends InteractiveEditorResponse | InteractiveEditorMessageResponse = InteractiveEditorResponse | InteractiveEditorMessageResponse> {

		// Create a session. The lifetime of this session is the duration of the editing session with the input mode widget.
		prepareInteractiveEditorSession(context: TextDocumentContext, token: CancellationToken): ProviderResult<S>;

		provideInteractiveEditorResponse(session: S, request: InteractiveEditorRequest, progress: Progress<InteractiveEditorProgressItem>, token: CancellationToken): ProviderResult<R>;

		provideFollowups?(session: S, response: R, token: CancellationToken): ProviderResult<InteractiveEditorReplyFollowup[]>;

		// eslint-disable-next-line local/vscode-dts-provider-naming
		handleInteractiveEditorResponseFeedback?(session: S, response: R, kind: InteractiveEditorResponseFeedbackKind): void;
	}

	export interface InteractiveSessionParticipantInformation {
		name: string;

		/**
		 * A full URI for the icon of the participant.
		 */
		icon?: Uri;
	}

	export interface InteractiveSession {
		requester: InteractiveSessionParticipantInformation;
		responder: InteractiveSessionParticipantInformation;
		inputPlaceholder?: string;
	}

	export interface InteractiveResponseCommand {
		commandId: string;
		args?: any[];
		title: string; // supports codicon strings
		when?: string;
	}

	export interface InteractiveSessionReplyFollowup {
		message: string;
		tooltip?: string;
		title?: string;
	}

	export type InteractiveWelcomeMessageContent = string | MarkdownString | InteractiveSessionReplyFollowup[];

	export interface InteractiveSessionProvider<S extends InteractiveSession = InteractiveSession> {
		provideWelcomeMessage?(token: CancellationToken): ProviderResult<InteractiveWelcomeMessageContent[]>;
		provideSampleQuestions?(token: CancellationToken): ProviderResult<InteractiveSessionReplyFollowup[]>;
		prepareSession(token: CancellationToken): ProviderResult<S>;
	}

	export interface InteractiveSessionDynamicRequest {
		/**
		 * The message that will be displayed in the UI
		 */
		message: string;
	}

	export namespace interactive {
		// current version of the proposal.
		export const _version: 1 | number;

		export function registerInteractiveSessionProvider(id: string, provider: InteractiveSessionProvider): Disposable;

		export function sendInteractiveRequestToProvider(providerId: string, message: InteractiveSessionDynamicRequest): void;

		export function registerInteractiveEditorSessionProvider(provider: InteractiveEditorSessionProvider, metadata?: InteractiveEditorSessionProviderMetadata): Disposable;

		export function transferChatSession(session: InteractiveSession, toWorkspace: Uri): void;
	}
}
