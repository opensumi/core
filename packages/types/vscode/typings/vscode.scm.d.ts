declare module 'vscode' {
  /**
   * Represents the input box in the Source Control viewlet.
   */
  export interface SourceControlInputBox {

    /**
     * Setter and getter for the contents of the input box.
     */
    value: string;

    /**
     * A string to show as place holder in the input box to guide the user.
     */
    placeholder: string;
  }

  /**
   * An source control is able to provide [resource states](#SourceControlResourceState)
   * to the editor and interact with the editor in several source control related ways.
   */
  export interface SourceControl {

    /**
     * The id of this source control.
     */
    readonly id: string;

    /**
     * The human-readable label of this source control.
     */
    readonly label: string;

    /**
     * The (optional) Uri of the root of this source control.
     */
    readonly rootUri: Uri | undefined;

    /**
     * The [input box](#SourceControlInputBox) for this source control.
     */
    readonly inputBox: SourceControlInputBox;

    /**
     * The UI-visible count of [resource states](#SourceControlResourceState) of
     * this source control.
     *
     * Equals to the total number of [resource state](#SourceControlResourceState)
     * of this source control, if undefined.
     */
    count?: number;

    /**
     * An optional [quick diff provider](#QuickDiffProvider).
     */
    quickDiffProvider?: QuickDiffProvider;

    /**
     * Optional commit template string.
     *
     * The Source Control viewlet will populate the Source Control
     * input with this value when appropriate.
     */
    commitTemplate?: string;

    /**
     * Optional accept input command.
     *
     * This command will be invoked when the user accepts the value
     * in the Source Control input.
     */
    acceptInputCommand?: Command;

    /**
     * Optional status bar commands.
     *
     * These commands will be displayed in the editor's status bar.
     */
    statusBarCommands?: Command[];

    /**
     * Create a new [resource group](#SourceControlResourceGroup).
     */
    createResourceGroup(id: string, label: string): SourceControlResourceGroup;

    /**
     * Dispose this source control.
     */
    dispose(): void;
  }

  export namespace scm {

    /**
     * ~~The [input box](#SourceControlInputBox) for the last source control
     * created by the extension.~~
     *
     * @deprecated Use SourceControl.inputBox instead
     */
    export const inputBox: SourceControlInputBox;

    /**
     * Creates a new [source control](#SourceControl) instance.
     *
     * @param id An `id` for the source control. Something short, e.g.: `git`.
     * @param label A human-readable string for the source control. E.g.: `Git`.
     * @param rootUri An optional Uri of the root of the source control. E.g.: `Uri.parse(workspaceRoot)`.
     * @return An instance of [source control](#SourceControl).
     */
    export function createSourceControl(id: string, label: string, rootUri?: Uri): SourceControl;
  }

  interface QuickDiffProvider {

    /**
     * Provide a [uri](#Uri) to the original resource of any given resource uri.
     *
     * @param uri The uri of the resource open in a text editor.
     * @param token A cancellation token.
     * @return A thenable that resolves to uri of the matching original resource.
     */
    provideOriginalResource?(uri: Uri, token: CancellationToken): ProviderResult<Uri>;
  }

  /**
   * The theme-aware decorations for a
   * [source control resource state](#SourceControlResourceState).
   */
  export interface SourceControlResourceThemableDecorations {

    /**
     * The icon path for a specific
     * [source control resource state](#SourceControlResourceState).
     */
    readonly iconPath?: string | Uri;
  }

  /**
   * The decorations for a [source control resource state](#SourceControlResourceState).
   * Can be independently specified for light and dark themes.
   */
  export interface SourceControlResourceDecorations extends SourceControlResourceThemableDecorations {

    /**
     * Whether the [source control resource state](#SourceControlResourceState) should
     * be striked-through in the UI.
     */
    readonly strikeThrough?: boolean;

    /**
     * Whether the [source control resource state](#SourceControlResourceState) should
     * be faded in the UI.
     */
    readonly faded?: boolean;

    /**
     * The title for a specific
     * [source control resource state](#SourceControlResourceState).
     */
    readonly tooltip?: string;

    /**
     * The light theme decorations.
     */
    readonly light?: SourceControlResourceThemableDecorations;

    /**
     * The dark theme decorations.
     */
    readonly dark?: SourceControlResourceThemableDecorations;
  }

  /**
   * An source control resource state represents the state of an underlying workspace
   * resource within a certain [source control group](#SourceControlResourceGroup).
   */
  export interface SourceControlResourceState {

    /**
     * The [uri](#Uri) of the underlying resource inside the workspace.
     */
    readonly resourceUri: Uri;

    /**
     * The [command](#Command) which should be run when the resource
     * state is open in the Source Control viewlet.
     */
    readonly command?: Command;

    /**
     * The [decorations](#SourceControlResourceDecorations) for this source control
     * resource state.
     */
    readonly decorations?: SourceControlResourceDecorations;

    /**
     * Context value of the resource state. This can be used to contribute resource specific actions.
     * For example, if a resource is given a context value as `diffable`. When contributing actions to `scm/resourceState/context`
     * using `menus` extension point, you can specify context value for key `scmResourceState` in `when` expressions, like `scmResourceState == diffable`.
     * ```
     *	"contributes": {
     *		"menus": {
     *			"scm/resourceState/context": [
     *				{
     *					"command": "extension.diff",
     *					"when": "scmResourceState == diffable"
     *				}
     *			]
     *		}
     *	}
     * ```
     * This will show action `extension.diff` only for resources with `contextValue` is `diffable`.
    */
    readonly contextValue?: string;
  }

  /**
   * A source control resource group is a collection of
   * [source control resource states](#SourceControlResourceState).
   */
  export interface SourceControlResourceGroup {

    /**
     * The id of this source control resource group.
     */
    readonly id: string;

    /**
     * The label of this source control resource group.
     */
    label: string;

    /**
     * Whether this source control resource group is hidden when it contains
     * no [source control resource states](#SourceControlResourceState).
     */
    hideWhenEmpty?: boolean;

    /**
     * This group's collection of
     * [source control resource states](#SourceControlResourceState).
     */
    resourceStates: SourceControlResourceState[];

    /**
     * Dispose this source control resource group.
     */
    dispose(): void;
  }
}
