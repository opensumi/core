declare module 'vscode' {
  /**
   * The kind of {@link QuickPickItem quick pick item}.
   */
  export enum QuickPickItemKind {
    /**
     * When a {@link QuickPickItem} has a kind of {@link Separator}, the item is just a visual separator and does not represent a real item.
     * The only property that applies is {@link QuickPickItem.label label }. All other properties on {@link QuickPickItem} will be ignored and have no effect.
     */
    Separator = -1,
    /**
     * The default {@link QuickPickItem.kind} is an item that can be selected in the quick pick.
     */
    Default = 0,
  }

  /**
   * Represents an item that can be selected from
   * a list of items.
   */
  export interface QuickPickItem {

    /**
     * A human readable string which is rendered prominent.
     */
    label: string;

    /**
     * The kind of QuickPickItem that will determine how this item is rendered in the quick pick. When not specified,
     * the default is {@link QuickPickItemKind.Default}.
     */
    kind?: QuickPickItemKind;

    /**
     * A human readable string which is rendered less prominent.
     */
    description?: string;

    /**
     * A human readable string which is rendered less prominent.
     */
    detail?: string;

    /**
     * Optional flag indicating if this item is picked initially.
     * (Only honored when the picker allows multiple selections.)
     *
     * @see [QuickPickOptions.canPickMany](#QuickPickOptions.canPickMany)
     * not implemented yet
     */
    picked?: boolean;

    /**
     * Always show this item.
     * not implemented yet
     */
    alwaysShow?: boolean;

    /**
     * Optional buttons that will be rendered on this particular item. These buttons will trigger
     * an {@link QuickPickItemButtonEvent} when clicked. Buttons are only rendered when using a quickpick
     * created by the {@link window.createQuickPick()} API. Buttons are not rendered when using
     * the {@link window.showQuickPick()} API.
     */
    buttons?: QuickInputButton[];
  }


  /**
 * A concrete [QuickInput](#QuickInput) to let the user pick an item from a
 * list of items of type T. The items can be filtered through a filter text field and
 * there is an option [canSelectMany](#QuickPick.canSelectMany) to allow for
 * selecting multiple items.
 *
 * Note that in many cases the more convenient [window.showQuickPick](#window.showQuickPick)
 * is easier to use. [window.createQuickPick](#window.createQuickPick) should be used
 * when [window.showQuickPick](#window.showQuickPick) does not offer the required flexibility.
 */
  export interface QuickPick<T extends QuickPickItem> extends QuickInput {

    /**
     * Current value of the filter text.
     */
    value: string;

    /**
     * Optional placeholder in the filter text.
     */
    placeholder: string | undefined;

    /**
     * An event signaling when the value of the filter text has changed.
     */
    readonly onDidChangeValue: Event<string>;

    /**
     * An event signaling when the user indicated acceptance of the selected item(s).
     */
    readonly onDidAccept: Event<void>;

    /**
     * Buttons for actions in the UI.
     * not implemented yet
     */
    buttons: ReadonlyArray<QuickInputButton>;

    /**
     * An event signaling when a button was triggered.
     */
    readonly onDidTriggerButton: Event<QuickInputButton>;


    /**
     * An event signaling when a button in a particular {@link QuickPickItem} was triggered.
     * This event does not fire for buttons in the title bar.
     */
    readonly onDidTriggerItemButton: Event<QuickPickItemButtonEvent<T>>;

    /**
     * Items to pick from.
     */
    items: ReadonlyArray<T>;

    /**
     * If multiple items can be selected at the same time. Defaults to false.
     * not implemented yet
     */
    canSelectMany: boolean;

    /**
     * If the filter text should also be matched against the description of the items. Defaults to false.
     */
    matchOnDescription: boolean;

    /**
     * If the filter text should also be matched against the detail of the items. Defaults to false.
     */
    matchOnDetail: boolean;

    /*
     * An optional flag to maintain the scroll position of the quick pick when the quick pick items are updated. Defaults to false.
     */
    keepScrollPosition?: boolean;

    /**
     * Active items. This can be read and updated by the extension.
     * not implemented yet
     */
    activeItems: ReadonlyArray<T>;

    /**
     * An event signaling when the active items have changed.
     */
    readonly onDidChangeActive: Event<T[]>;

    /**
     * Selected items. This can be read and updated by the extension.
     * not implemented yet
     */
    selectedItems: ReadonlyArray<T>;

    /**
     * An event signaling when the selected items have changed.
     */
    readonly onDidChangeSelection: Event<T[]>;
  }

  /**
   * Options to configure the behavior of the quick pick UI.
   */
  export interface QuickPickOptions {

    /**
     * An optional string that represents the title of the quick pick.
     */
    title?: string;

    /**
     * An optional flag to include the description when filtering the picks.
     */
    matchOnDescription?: boolean;

    /**
     * An optional flag to include the detail when filtering the picks.
     */
    matchOnDetail?: boolean;

    /*
     * An optional flag to maintain the scroll position of the quick pick when the quick pick items are updated. Defaults to false.
     */
    keepScrollPosition?: boolean;

    /**
     * An optional string to show as place holder in the input box to guide the user what to pick on.
     */
    placeHolder?: string;

    /**
     * Set to `true` to keep the picker open when focus moves to another part of the editor or to another window.
     */
    ignoreFocusOut?: boolean;

    /**
     * An optional flag to make the picker accept multiple selections, if true the result is an array of picks.
     * not implemented yet
     */
    canPickMany?: boolean;

    /**
     * An optional function that is invoked whenever an item is selected.
     */
    onDidSelectItem?(item: QuickPickItem | string): any;
  }


  /**
   * A light-weight user input UI that is initially not visible. After
   * configuring it through its properties the extension can make it
   * visible by calling [QuickInput.show](#QuickInput.show).
   *
   * There are several reasons why this UI might have to be hidden and
   * the extension will be notified through [QuickInput.onDidHide](#QuickInput.onDidHide).
   * (Examples include: an explicit call to [QuickInput.hide](#QuickInput.hide),
   * the user pressing Esc, some other input UI opening, etc.)
   *
   * A user pressing Enter or some other gesture implying acceptance
   * of the current state does not automatically hide this UI component.
   * It is up to the extension to decide whether to accept the user's input
   * and if the UI should indeed be hidden through a call to [QuickInput.hide](#QuickInput.hide).
   *
   * When the extension no longer needs this input UI, it should
   * [QuickInput.dispose](#QuickInput.dispose) it to allow for freeing up
   * any resources associated with it.
   *
   * See [QuickPick](#QuickPick) and [InputBox](#InputBox) for concrete UIs.
   */
  export interface QuickInput {

    /**
     * An optional title.
     */
    title: string | undefined;

    /**
     * An optional current step count.
     */
    step: number | undefined;

    /**
     * An optional total step count.
     */
    totalSteps: number | undefined;

    /**
     * If the UI should allow for user input. Defaults to true.
     *
     * Change this to false, e.g., while validating user input or
     * loading data for the next step in user input.
     */
    enabled: boolean;

    /**
     * If the UI should show a progress indicator. Defaults to false.
     *
     * Change this to true, e.g., while loading more data or validating
     * user input.
     */
    busy: boolean;

    /**
     * If the UI should stay open even when loosing UI focus. Defaults to false.
     */
    ignoreFocusOut: boolean;

    /**
     * Makes the input UI visible in its current configuration. Any other input
     * UI will first fire an [QuickInput.onDidHide](#QuickInput.onDidHide) event.
     */
    show(): void;

    /**
     * Hides this input UI. This will also fire an [QuickInput.onDidHide](#QuickInput.onDidHide)
     * event.
     */
    hide(): void;

    /**
     * An event signaling when this input UI is hidden.
     *
     * There are several reasons why this UI might have to be hidden and
     * the extension will be notified through [QuickInput.onDidHide](#QuickInput.onDidHide).
     * (Examples include: an explicit call to [QuickInput.hide](#QuickInput.hide),
     * the user pressing Esc, some other input UI opening, etc.)
     */
    onDidHide: Event<void>;

    /**
     * Dispose of this input UI and any associated resources. If it is still
     * visible, it is first hidden. After this call the input UI is no longer
     * functional and no additional methods or properties on it should be
     * accessed. Instead a new input UI should be created.
     */
    dispose(): void;
  }


  /**
   * Options to configure the behavior of the input box UI.
   */
  export interface InputBoxOptions {

    /**
     * An optional string that represents the title of the input box.
     */
    title?: string;

    /**
     * The value to prefill in the input box.
     */
    value?: string;

    /**
     * Selection of the prefilled [`value`](#InputBoxOptions.value). Defined as tuple of two number where the
     * first is the inclusive start index and the second the exclusive end index. When `undefined` the whole
     * word will be selected, when empty (start equals end) only the cursor will be set,
     * otherwise the defined range will be selected.
     */
    valueSelection?: [number, number];

    /**
     * The text to display underneath the input box.
     */
    prompt?: string;

    /**
     * An optional string to show as place holder in the input box to guide the user what to type.
     */
    placeHolder?: string;

    /**
     * Set to `true` to show a password prompt that will not show the typed value.
     */
    password?: boolean;

    /**
     * Set to `true` to keep the input box open when focus moves to another part of the editor or to another window.
     */
    ignoreFocusOut?: boolean;

    /**
     * An optional function that will be called to validate input and to give a hint
     * to the user.
     *
     * @param value The current value of the input box.
     * @return A human readable string which is presented as diagnostic message.
     * Return `undefined`, `null`, or the empty string when 'value' is valid.
     */
    validateInput?(value: string): string | InputBoxValidationMessage | undefined | null | Thenable<string | InputBoxValidationMessage | undefined | null>;
  }

  /**
 * A concrete [QuickInput](#QuickInput) to let the user input a text value.
 *
 * Note that in many cases the more convenient [window.showInputBox](#window.showInputBox)
 * is easier to use. [window.createInputBox](#window.createInputBox) should be used
 * when [window.showInputBox](#window.showInputBox) does not offer the required flexibility.
 */
  export interface InputBox extends QuickInput {

    /**
     * Current input value.
     */
    value: string;

    /**
     * Optional placeholder in the filter text.
     */
    placeholder: string | undefined;

    /**
     * If the input value should be hidden. Defaults to false.
     */
    password: boolean;

    /**
     * An event signaling when the value has changed.
     */
    readonly onDidChangeValue: Event<string>;

    /**
     * An event signaling when the user indicated acceptance of the input value.
     */
    readonly onDidAccept: Event<void>;

    /**
     * Buttons for actions in the UI.
     */
    buttons: ReadonlyArray<QuickInputButton>;

    /**
     * An event signaling when a button was triggered.
     */
    readonly onDidTriggerButton: Event<QuickInputButton>;

    /**
     * An optional prompt text providing some ask or explanation to the user.
     */
    prompt: string | undefined;

    /**
     * An optional validation message indicating a problem with the current input value.
     */
    validationMessage: string | InputBoxValidationMessage | undefined;
  }


  export namespace window {
    /**
     * Creates a [QuickPick](#QuickPick) to let the user pick an item from a list
     * of items of type T.
     *
     * Note that in many cases the more convenient [window.showQuickPick](#window.showQuickPick)
     * is easier to use. [window.createQuickPick](#window.createQuickPick) should be used
     * when [window.showQuickPick](#window.showQuickPick) does not offer the required flexibility.
     *
     * @return A new [QuickPick](#QuickPick).
     */
    export function createQuickPick<T extends QuickPickItem>(): QuickPick<T>;
    /**
     * Shows a selection list allowing multiple selections.
     *
     * @param items An array of strings, or a promise that resolves to an array of strings.
     * @param options Configures the behavior of the selection list.
     * @param token A token that can be used to signal cancellation.
     * @return A promise that resolves to the selected items or `undefined`.
     */
    export function showQuickPick(items: string[] | Thenable<string[]>, options: QuickPickOptions & { canPickMany: true; }, token?: CancellationToken): Thenable<string[] | undefined>;

    /**
     * Shows a selection list.
     *
     * @param items An array of strings, or a promise that resolves to an array of strings.
     * @param options Configures the behavior of the selection list.
     * @param token A token that can be used to signal cancellation.
     * @return A promise that resolves to the selection or `undefined`.
     */
    export function showQuickPick(items: string[] | Thenable<string[]>, options?: QuickPickOptions, token?: CancellationToken): Thenable<string | undefined>;

    /**
     * Shows a selection list allowing multiple selections.
     *
     * @param items An array of items, or a promise that resolves to an array of items.
     * @param options Configures the behavior of the selection list.
     * @param token A token that can be used to signal cancellation.
     * @return A promise that resolves to the selected items or `undefined`.
     */
    export function showQuickPick<T extends QuickPickItem>(items: T[] | Thenable<T[]>, options: QuickPickOptions & { canPickMany: true; }, token?: CancellationToken): Thenable<T[] | undefined>;

    /**
     * Shows a selection list.
     *
     * @param items An array of items, or a promise that resolves to an array of items.
     * @param options Configures the behavior of the selection list.
     * @param token A token that can be used to signal cancellation.
     * @return A promise that resolves to the selected item or `undefined`.
     */
    export function showQuickPick<T extends QuickPickItem>(items: T[] | Thenable<T[]>, options?: QuickPickOptions, token?: CancellationToken): Thenable<T | undefined>;

    /**
   * Opens an input box to ask the user for input.
   *
   * The returned value will be `undefined` if the input box was canceled (e.g. pressing ESC). Otherwise the
   * returned value will be the string typed by the user or an empty string if the user did not type
   * anything but dismissed the input box with OK.
   *
   * @param options Configures the behavior of the input box.
   * @param token A token that can be used to signal cancellation.
   * @return A promise that resolves to a string the user provided or to `undefined` in case of dismissal.
   */
    export function showInputBox(options?: InputBoxOptions, token?: CancellationToken): Thenable<string | undefined>;



    /**
     * Creates a [InputBox](#InputBox) to let the user enter some text input.
     *
     * Note that in many cases the more convenient [window.showInputBox](#window.showInputBox)
     * is easier to use. [window.createInputBox](#window.createInputBox) should be used
     * when [window.showInputBox](#window.showInputBox) does not offer the required flexibility.
     *
     * @return A new [InputBox](#InputBox).
     */
    export function createInputBox(): InputBox;
  }


  /**
   * Button for an action in a [QuickPick](#QuickPick) or [InputBox](#InputBox).
   */
  export interface QuickInputButton {

    /**
     * Icon for the button.
     */
    readonly iconPath: Uri | { light: Uri; dark: Uri } | ThemeIcon;

    /**
     * An optional tooltip.
     */
    readonly tooltip?: string | undefined;
  }

  /**
   * Predefined buttons for [QuickPick](#QuickPick) and [InputBox](#InputBox).
   */
  export class QuickInputButtons {

    /**
     * A back button for [QuickPick](#QuickPick) and [InputBox](#InputBox).
     *
     * When a navigation 'back' button is needed this one should be used for consistency.
     * It comes with a predefined icon, tooltip and location.
     */
    static readonly Back: QuickInputButton;

    /**
     * @hidden
     */
    private constructor();
  }

  /**
   * An event signaling when a button in a particular {@link QuickPickItem} was triggered.
   * This event does not fire for buttons in the title bar.
   */
  export interface QuickPickItemButtonEvent<T extends QuickPickItem> {
    /**
     * The button that was clicked.
     */
    readonly button: QuickInputButton;
    /**
     * The item that the button belongs to.
     */
    readonly item: T;
  }

  /**
   * Impacts the behavior and appearance of the validation message.
   */
  export enum InputBoxValidationSeverity {
    Ignore = 0,
    Info = 1,
    Warning = 2,
    Error = 3
  }

  /**
   * Object to configure the behavior of the validation message.
   */
  export interface  InputBoxValidationMessage {
    /**
     * The validation message to display.
     */
    readonly message: string;

    /**
     * The severity of the validation message.
     * NOTE: When using `InputBoxValidationSeverity.Error`, the user will not be allowed to accept (hit ENTER) the input.
     * `Info` and `Warning` will still allow the InputBox to accept the input.
     */
    readonly severity: InputBoxValidationSeverity;
  }
}
