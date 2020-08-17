
import { KeySequence, KeybindingRegistry, QuickOpenActionProvider, QuickOpenAction, HideReason, compareAnything } from '@ali/ide-core-browser';
import { MessageType, MarkerSeverity } from '@ali/ide-core-common';
import { QuickOpenMode, QuickOpenModel, QuickOpenItem, QuickOpenGroupItem, QuickOpenService, QuickOpenOptions } from '@ali/ide-core-browser/lib/quick-open';
import { Injectable, Autowired } from '@ali/common-di';
import { MonacoResolvedKeybinding } from '@ali/ide-monaco/lib/browser/monaco.resolved-keybinding';
import { MonacoContextKeyService } from '@ali/ide-monaco/lib/browser/monaco.context-key.service';

export interface MonacoQuickOpenControllerOpts extends monaco.quickOpen.IQuickOpenControllerOpts {
  valueSelection?: Readonly<[number, number]>;
  enabled?: boolean;
  readonly prefix?: string;
  readonly password?: boolean;
  ignoreFocusOut?: boolean;
  onType?(lookFor: string, acceptor: (model: monaco.quickOpen.QuickOpenModel) => void): void;
  onClose?(canceled: boolean): void;
}

export class MonacoQuickOpenAction implements monaco.quickOpen.IAction {
  constructor(public readonly action: QuickOpenAction) { }

  get id(): string {
    return this.action.id;
  }

  get label(): string {
    return this.action.label || '';
  }

  get tooltip(): string {
    return this.action.tooltip || '';
  }

  get class(): string | undefined {
    return this.action.class;
  }

  get enabled(): boolean {
    return this.action.enabled || true;
  }

  get checked(): boolean {
    return this.action.checked || false;
  }

  get radio(): boolean {
    return this.action.radio || false;
  }

  run(entry: QuickOpenEntry | QuickOpenEntryGroup): PromiseLike<any> {
    return this.action.run(entry.item);
  }

  dispose(): void {
    this.action.dispose();
  }
}

export class MonacoQuickOpenActionProvider implements monaco.quickOpen.IActionProvider {
  constructor(public readonly provider: QuickOpenActionProvider) { }

  hasActions(element: any, entry: QuickOpenEntry | QuickOpenEntryGroup): boolean {
    return this.provider.hasActions(entry.item);
  }

  getActions(element: any, entry: QuickOpenEntry | QuickOpenEntryGroup): ReadonlyArray<monaco.quickOpen.IAction> {
    return this.provider.getActions(entry.item).map((action) => new MonacoQuickOpenAction(action));
  }
}

@Injectable()
export class MonacoQuickOpenService implements QuickOpenService {

  protected _widget: monaco.quickOpen.QuickOpenWidget | undefined;
  protected _widgetNode: HTMLElement;
  protected opts: MonacoQuickOpenControllerOpts;
  protected readonly container: HTMLElement;
  protected previousActiveElement: Element | undefined;

  @Autowired(KeybindingRegistry)
  protected keybindingRegistry: KeybindingRegistry;

  @Autowired(MonacoContextKeyService)
  protected readonly contextKeyService: MonacoContextKeyService;

  constructor() {
    const overlayWidgets = document.createElement('div');
    overlayWidgets.classList.add('quick-open-overlay');
    document.body.appendChild(overlayWidgets);

    const container = this.container = document.createElement('quick-open-container');
    container.style.position = 'absolute';
    container.style.top = '0px';
    container.style.right = '50%';
    container.style.zIndex = '1000000';
    overlayWidgets.appendChild(container);
  }

  open(model: QuickOpenModel, options?: Partial<QuickOpenOptions.Resolved> | undefined): void {
    this.internalOpen(new MonacoQuickOpenModel(model, this.keybindingRegistry, options));
  }

  hide(reason?: HideReason): void {
    this.widget.hide(reason);
  }

  internalOpen(opts: MonacoQuickOpenControllerOpts): void {
    this.opts = opts;

    const activeContext = window.document.activeElement || undefined;

    if (!activeContext || !this.container.contains(activeContext)) {
      this.previousActiveElement = activeContext;
      this.contextKeyService.activeContext = activeContext instanceof HTMLElement ? activeContext : undefined;
    }

    this.hideDecoration();

    this.widget.show(this.opts.prefix || '');

    this.setPlaceHolder(opts.inputAriaLabel);

    this.setPassword(opts.password ? true : false);

    this.setEnabled(opts.enabled);

    this.setValueSelected(opts.inputAriaLabel, opts.valueSelection);

    const widget = this.widget;
    if (widget.inputBox) {
      widget.inputBox.inputElement.tabIndex = 1;
    }
  }

  setValueSelected(value: string | undefined, selectLocation: Readonly<[number, number]> | undefined): void {
    if (!value) {
      return;
    }

    const widget = this.widget;
    if (widget.inputBox) {

      if (!selectLocation) {
        widget.inputBox.inputElement.setSelectionRange(0, value.length);
        return;
      }

      if (selectLocation[0] === selectLocation[1]) {
        widget.inputBox.inputElement.setSelectionRange(selectLocation[0], selectLocation[0]);
        return;
      }

      widget.inputBox.inputElement.setSelectionRange(selectLocation[0], selectLocation[1]);
    }
  }

  setEnabled(isEnabled: boolean | undefined): void {
    const widget = this.widget;
    if (widget.inputBox) {
      widget.inputBox.inputElement.readOnly = (isEnabled !== undefined) ? !isEnabled : false;
    }
  }

  refresh(): void {
    const inputBox = this.widget.inputBox;
    if (inputBox) {
      this.onType(inputBox.inputElement.value);
    }
  }

  public get widget(): monaco.quickOpen.QuickOpenWidget {
    if (this._widget) {
      return this._widget;
    }
    this._widget = new monaco.quickOpen.QuickOpenWidget(
      this.container,
      {
        onOk: () => {
          this.previousActiveElement = undefined;
          this.contextKeyService.activeContext = undefined;
          this.onClose(false);
        },
        onCancel: () => {
          if (this.previousActiveElement instanceof HTMLElement) {
            this.previousActiveElement.focus();
          }
          this.previousActiveElement = undefined;
          this.contextKeyService.activeContext = undefined;
          this.onClose(true);
        },
        onType: (lookFor) => this.onType(lookFor || ''),
        onFocusLost: () => {
          if (this.opts && this.opts.ignoreFocusOut !== undefined) {
            if (this.opts.ignoreFocusOut === false) {
              this.onClose(true);
            }
            return this.opts.ignoreFocusOut;
          } else {
            return false;
          }
        },
      },
      {},
    );
    this.attachQuickOpenStyler();
    const newWidget = this._widget.create();
    this._widgetNode = newWidget;
    return this._widget;
  }

  public get widgetNode() {
    return this._widgetNode;
  }

  protected attachQuickOpenStyler(): void {
    if (!this._widget) {
      return;
    }
    const themeService = monaco.services.StaticServices.standaloneThemeService.get();
    const detach = monaco.theme.attachQuickOpenStyler(this._widget, themeService);
    const dispose = themeService.onThemeChange(() => {
      detach.dispose();
      this.attachQuickOpenStyler();
      dispose.dispose();
    });
  }

  setPlaceHolder(placeHolder: string): void {
    const widget = this.widget;
    if (widget.inputBox) {
      widget.inputBox.setPlaceHolder(placeHolder);
    }
  }

  protected onClose(cancelled: boolean): void {
    if (this.opts.onClose) {
      this.opts.onClose(cancelled);
    }
  }

  protected async onType(lookFor: string): Promise<void> {
    const options = this.opts;
    if (this.widget && options.onType) {
      options.onType(lookFor, (model) =>
        this.widget.setInput(model, options.getAutoFocus(lookFor), options.inputAriaLabel));
    }
  }

  protected onFocusLost(): boolean {
    return !!this.opts.ignoreFocusOut;
  }

  showDecoration(type: MessageType): void {
    let decoration = MarkerSeverity.Info;
    if (type === MessageType.Warning) {
      decoration = MarkerSeverity.Warning;
    } else if (type === MessageType.Error) {
      decoration = MarkerSeverity.Error;
    }
    this.showInputDecoration(decoration);
  }

  hideDecoration(): void {
    this.clearInputDecoration();
  }

  setPassword(isPassword: boolean): void {
    const widget = this.widget;
    if (widget.inputBox) {
      widget.inputBox.inputElement.type = isPassword ? 'password' : 'text';
    }
  }

  showInputDecoration(decoration: MarkerSeverity): void {
    const widget = this.widget;
    if (widget.inputBox) {
      const type = decoration === MarkerSeverity.Info ? 1 :
        decoration === MarkerSeverity.Warning ? 2 : 3;
      widget.inputBox.showMessage({ type, content: '' });
    }
  }

  clearInputDecoration(): void {
    const widget = this.widget;
    if (widget.inputBox) {
      widget.inputBox.hideMessage();
    }
  }

}

export class MonacoQuickOpenModel implements MonacoQuickOpenControllerOpts {

  protected readonly options: QuickOpenOptions.Resolved;

  constructor(
    protected readonly model: QuickOpenModel,
    protected keybindingRegistry: KeybindingRegistry,
    options?: QuickOpenOptions,
  ) {
    this.model = model;
    this.options = QuickOpenOptions.resolve(options);

  }

  get prefix(): string {
    return this.options.prefix;
  }

  get inputAriaLabel(): string {
    return this.options.placeholder || '';
  }

  get ignoreFocusOut(): boolean {
    return this.options.ignoreFocusOut;
  }

  get password(): boolean {
    return this.options.password;
  }

  get enabled(): boolean {
    return this.options.enabled;
  }

  get valueSelection(): Readonly<[number, number]> {
    return this.options.valueSelection;
  }

  onClose(cancelled: boolean): void {
    this.options.onClose(cancelled);
  }

  onType(lookFor: string, acceptor: (model: monaco.quickOpen.QuickOpenModel) => void): void {
    this.model.onType(lookFor, (items, actionProvider) => {
      const result = this.toOpenModel(lookFor, items, actionProvider);
      acceptor(result);
    });
  }

  getModel(lookFor: string): monaco.quickOpen.QuickOpenModel {
    throw new Error('getModel not supported!');
  }

  /**
   * A good default sort implementation for quick open entries respecting highlight information
   * as well as associated resources.
   */
  private compareEntries(elementA: monaco.quickOpen.QuickOpenEntry, elementB: monaco.quickOpen.QuickOpenEntry, lookFor: string): number {

    // Give matches with label highlights higher priority over
    // those with only description highlights
    const labelHighlightsA = elementA.getHighlights()[0] || [];
    const labelHighlightsB = elementB.getHighlights()[0] || [];
    if (labelHighlightsA.length && !labelHighlightsB.length) {
      return -1;
    }

    if (!labelHighlightsA.length && labelHighlightsB.length) {
      return 1;
    }

    const nameA = elementA.getLabel()!;
    const nameB = elementB.getLabel()!;

    return compareAnything(nameA, nameB, lookFor);
  }

  private toOpenModel(lookFor: string, items: QuickOpenItem[], actionProvider?: QuickOpenActionProvider): monaco.quickOpen.QuickOpenModel {
    const entries: monaco.quickOpen.QuickOpenEntry[] = [];
    if (this.options.skipPrefix) {
      lookFor = lookFor.substr(this.options.skipPrefix);
    }

    if (actionProvider && actionProvider.getValidateInput) {
      lookFor = actionProvider.getValidateInput(lookFor);
    }

    for (const item of items) {
      const entry = this.createEntry(item, lookFor);
      if (entry) {
        entries.push(entry);
      }
    }
    if (this.options.fuzzySort) {
      entries.sort((a, b) => this.compareEntries(a, b, lookFor));
    }

    return new monaco.quickOpen.QuickOpenModel(entries, actionProvider ? new MonacoQuickOpenActionProvider(actionProvider) : undefined);
  }

  protected createEntry(item: QuickOpenItem, lookFor: string): monaco.quickOpen.QuickOpenEntry | undefined {
    const { fuzzyMatchLabel, fuzzyMatchDescription, fuzzyMatchDetail } = this.options;
    const labelHighlights = fuzzyMatchLabel ? this.matchesFuzzy(lookFor, item.getLabel(), fuzzyMatchLabel) : item.getLabelHighlights();
    const descriptionHighlights = this.options.fuzzyMatchDescription ? this.matchesFuzzy(lookFor, item.getDescription(), fuzzyMatchDescription) : item.getDescriptionHighlights();
    const detailHighlights = this.options.fuzzyMatchDetail ? this.matchesFuzzy(lookFor, item.getDetail(), fuzzyMatchDetail) : item.getDetailHighlights();
    if ((lookFor && !labelHighlights && !descriptionHighlights && (!detailHighlights || detailHighlights.length === 0))
      && !this.options.showItemsWithoutHighlight) {
      return undefined;
    }
    const entry = item instanceof QuickOpenGroupItem ? new QuickOpenEntryGroup(item, this.keybindingRegistry) : new QuickOpenEntry(item, this.keybindingRegistry);
    entry.setHighlights(labelHighlights || [], descriptionHighlights, detailHighlights);
    return entry;
  }

  protected matchesFuzzy(lookFor: string, value: string | undefined, options?: QuickOpenOptions.FuzzyMatchOptions | boolean): monaco.quickOpen.IHighlight[] | undefined {
    if (!lookFor || !value) {
      return [];
    }
    const enableSeparateSubstringMatching = typeof options === 'object' && options.enableSeparateSubstringMatching;
    return monaco.filters.matchesFuzzy(lookFor, value, enableSeparateSubstringMatching);
  }

  getAutoFocus(lookFor: string): monaco.quickOpen.IAutoFocus {
    if (this.options.selectIndex) {
      const idx = this.options.selectIndex(lookFor);
      if (idx >= 0) {
        return {
          autoFocusIndex: idx,
        };
      }
    }
    return {
      autoFocusFirstEntry: true,
      autoFocusPrefixMatch: lookFor,
    };
  }

}

export class QuickOpenEntry extends monaco.quickOpen.QuickOpenEntry {

  constructor(
    public readonly item: QuickOpenItem,
    protected keybindingRegistry: KeybindingRegistry,
  ) {
    super();
  }

  getLabel(): string | undefined {
    return this.item.getLabel();
  }

  getAriaLabel(): string | undefined {
    return this.item.getTooltip();
  }

  getDetail(): string | undefined {
    return this.item.getDetail();
  }

  getDescription(): string | undefined {
    return this.item.getDescription();
  }

  isHidden(): boolean {
    return super.isHidden() || this.item.isHidden();
  }

  getResource(): monaco.Uri | undefined {
    const uri = this.item.getUri();
    return uri ? monaco.Uri.parse(uri.toString()) : undefined;
  }

  getIcon(): string | undefined {
    return this.item.getIconClass();
  }

  getKeybinding(): monaco.keybindings.ResolvedKeybinding | undefined {
    const keybinding = this.item.getKeybinding();

    if (!keybinding) {
      return undefined;
    }

    let keySequence: KeySequence;
    try {
      keySequence = this.keybindingRegistry.resolveKeybinding(keybinding);
    } catch (error) {
      return undefined;
    }
    return new MonacoResolvedKeybinding(keySequence, this.keybindingRegistry);
  }

  run(mode: QuickOpenMode): boolean {
    if (mode === QuickOpenMode.OPEN) {
      return this.item.run(QuickOpenMode.OPEN);
    }
    if (mode === QuickOpenMode.OPEN_IN_BACKGROUND) {
      return this.item.run(QuickOpenMode.OPEN_IN_BACKGROUND);
    }
    if (mode === QuickOpenMode.PREVIEW) {
      return this.item.run(QuickOpenMode.PREVIEW);
    }
    return false;
  }

}

export class QuickOpenEntryGroup extends monaco.quickOpen.QuickOpenEntryGroup {

  constructor(
    public readonly item: QuickOpenGroupItem,
    protected keybindingRegistry: KeybindingRegistry,
  ) {
    super(new QuickOpenEntry(item, keybindingRegistry));
  }

  getGroupLabel(): string {
    return this.item.getGroupLabel() || '';
  }

  showBorder(): boolean {
    return this.item.showBorder();
  }

  getKeybinding(): monaco.keybindings.ResolvedKeybinding | undefined {
    return this.entry ? this.entry.getKeybinding() : super.getKeybinding();
  }

}
