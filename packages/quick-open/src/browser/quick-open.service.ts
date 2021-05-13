import { IAction } from '@ali/monaco-editor-core/esm/vs/base/common/actions';
import { matchesFuzzy } from '@ali/monaco-editor-core/esm/vs/base/common/filters';
import { ResolvedKeybinding } from '@ali/monaco-editor-core/esm/vs/base/common/keyCodes';
import { IHighlight, QuickOpenEntry, QuickOpenEntryGroup, QuickOpenModel } from '@ali/monaco-editor-core/esm/vs/base/parts/quickopen/browser/quickOpenModel';
import { QuickOpenWidget } from '@ali/monaco-editor-core/esm/vs/base/parts/quickopen/browser/quickOpenWidget';
import { IAutoFocus, IEntryRunContext, Mode } from '@ali/monaco-editor-core/esm/vs/base/parts/quickopen/common/quickOpen';
import { IActionProvider } from '@ali/monaco-editor-core/esm/vs/base/parts/tree/browser/tree';
import * as monaco from '@ali/monaco-editor-core/esm/vs/editor/editor.api';
import { IQuickOpenControllerOpts } from '@ali/monaco-editor-core/esm/vs/editor/standalone/browser/quickOpen/editorQuickOpen';
import { StaticServices } from '@ali/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';
import * as theme from '@ali/monaco-editor-core/esm/vs/platform/theme/common/styler';

import { Autowired, Injectable } from '@ali/common-di';
import { compareAnything, HideReason, KeybindingRegistry, KeySequence, QuickOpenAction, QuickOpenActionProvider } from '@ali/ide-core-browser';
import { QuickOpenGroupItem, QuickOpenItem, QuickOpenModel as IKaitianQuickOpenModel, QuickOpenOptions, QuickOpenService } from '@ali/ide-core-browser/lib/quick-open';
import { MarkerSeverity, MessageType } from '@ali/ide-core-common';
import { MonacoContextKeyService } from '@ali/ide-monaco/lib/browser/monaco.context-key.service';
import { MonacoResolvedKeybinding } from '@ali/ide-monaco/lib/browser/monaco.resolved-keybinding';

export interface IKaitianQuickOpenControllerOpts extends IQuickOpenControllerOpts {
  valueSelection?: Readonly<[number, number]>;
  enabled?: boolean;
  readonly prefix?: string;
  readonly password?: boolean;
  ignoreFocusOut?: boolean;
  onType?(lookFor: string, acceptor: (model: QuickOpenModel) => void): void;
  onClose?(canceled: boolean): void;
}

export class MonacoQuickOpenAction implements IAction {
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

  run(entry: MonacoQuickOpenEntry | MonacoQuickOpenEntryGroup): Promise<any> {
    return this.action.run(entry.item);
  }

  dispose(): void {
    this.action.dispose();
  }
}

export class MonacoQuickOpenActionProvider implements IActionProvider {
  constructor(public readonly provider: QuickOpenActionProvider) { }

  hasActions(element: any, entry: MonacoQuickOpenEntry | MonacoQuickOpenEntryGroup): boolean {
    return this.provider.hasActions(entry.item);
  }

  getActions(element: any, entry: MonacoQuickOpenEntry | MonacoQuickOpenEntryGroup): ReadonlyArray<IAction> {
    return this.provider.getActions(entry.item).map((action) => new MonacoQuickOpenAction(action));
  }
}

@Injectable()
export class MonacoQuickOpenService implements QuickOpenService {

  protected _widget: QuickOpenWidget | undefined;
  protected _widgetNode: HTMLElement;
  protected opts: IKaitianQuickOpenControllerOpts;
  protected container: HTMLElement;
  protected previousActiveElement: Element | undefined;

  @Autowired(KeybindingRegistry)
  protected keybindingRegistry: KeybindingRegistry;

  @Autowired(MonacoContextKeyService)
  protected readonly contextKeyService: MonacoContextKeyService;

  private appendQuickOpenContainer() {
    const overlayContainer = document.querySelector('#ide-overlay');

    if (!overlayContainer) {
      throw new Error('ide-overlay is requried');
    }

    const overlayWidgets = document.createElement('div');
    overlayWidgets.classList.add('quick-open-overlay');
    overlayContainer.appendChild(overlayWidgets);

    const container = this.container = document.createElement('quick-open-container');
    container.style.position = 'fixed';
    container.style.top = '0px';
    container.style.right = '50%';
    container.style.zIndex = '1000000';
    overlayWidgets.appendChild(container);
  }

  open(model: IKaitianQuickOpenModel, options?: Partial<QuickOpenOptions.Resolved> | undefined): void {
    const opts = new KaitianQuickOpenControllerOpts(model, this.keybindingRegistry, options);
    this.internalOpen(opts);
  }

  hide(reason?: HideReason): void {
    this.widget.hide(reason);
  }

  internalOpen(opts: IKaitianQuickOpenControllerOpts): void {
    this.opts = opts;
    const widget = this.widget;

    const activeContext = window.document.activeElement || undefined;

    if (!activeContext || !this.container.contains(activeContext)) {
      this.previousActiveElement = activeContext;
      this.contextKeyService.activeContext = activeContext instanceof HTMLElement ? activeContext : undefined;
    }

    this.hideDecoration();

    widget.show(this.opts.prefix || '');

    this.setPlaceHolder(opts.inputAriaLabel);

    this.setPassword(opts.password ? true : false);

    this.setEnabled(opts.enabled);

    this.setValueSelected(opts.inputAriaLabel, opts.valueSelection);

    if (widget['inputBox']) {
      widget['inputBox'].inputElement.tabIndex = 1;
    }
  }

  setValueSelected(value: string | undefined, selectLocation: Readonly<[number, number]> | undefined): void {
    if (!value) {
      return;
    }

    const widget = this.widget;
    if (widget['inputBox']) {

      if (!selectLocation) {
        widget['inputBox'].inputElement.setSelectionRange(0, value.length);
        return;
      }

      if (selectLocation[0] === selectLocation[1]) {
        widget['inputBox'].inputElement.setSelectionRange(selectLocation[0], selectLocation[0]);
        return;
      }

      widget['inputBox'].inputElement.setSelectionRange(selectLocation[0], selectLocation[1]);
    }
  }

  setEnabled(isEnabled: boolean | undefined): void {
    const widget = this.widget;
    if (widget['inputBox']) {
      widget['inputBox'].inputElement.readOnly = (isEnabled !== undefined) ? !isEnabled : false;
    }
  }

  refresh(): void {
    const inputBox = this.widget['inputBox'];
    if (inputBox) {
      this.onType(inputBox.inputElement.value);
    }
  }

  public get widget(): QuickOpenWidget {
    if (this._widget) {
      return this._widget;
    }
    this.appendQuickOpenContainer();
    this._widget = new QuickOpenWidget(
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

  get widgetInputBox() {
    // FIXME: access private property from parent class
    return this.widget['inputBox'];
  }

  public get widgetNode() {
    return this._widgetNode;
  }

  protected attachQuickOpenStyler(): void {
    if (!this._widget) {
      return;
    }
    const themeService = StaticServices.standaloneThemeService.get();
    const detach = theme.attachQuickOpenStyler(this._widget, themeService);
    const dispose = themeService.onThemeChange(() => {
      detach.dispose();
      this.attachQuickOpenStyler();
      dispose.dispose();
    });
  }

  setPlaceHolder(placeHolder: string): void {
    const widget = this.widget;
    if (widget['inputBox']) {
      widget['inputBox'].setPlaceHolder(placeHolder);
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
    if (this.widgetInputBox) {
      this.widgetInputBox.inputElement.type = isPassword ? 'password' : 'text';
    }
  }

  showInputDecoration(decoration: MarkerSeverity): void {
    const widget = this.widget;
    if (widget['inputBox']) {
      const type = decoration === MarkerSeverity.Info ? 1 :
        decoration === MarkerSeverity.Warning ? 2 : 3;
      widget['inputBox'].showMessage({ type, content: '' });
    }
  }

  clearInputDecoration(): void {
    const widget = this.widget;
    if (widget['inputBox']) {
      widget['inputBox'].hideMessage();
    }
  }

}

export class KaitianQuickOpenControllerOpts implements IKaitianQuickOpenControllerOpts {

  protected readonly options: QuickOpenOptions.Resolved;

  constructor(
    protected readonly model: IKaitianQuickOpenModel,
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

  onType(lookFor: string, acceptor: (model: QuickOpenModel) => void): void {
    this.model.onType(lookFor, (items, actionProvider) => {
      const result = this.toOpenModel(lookFor, items, actionProvider);
      acceptor(result);
    });
  }

  getModel(lookFor: string): QuickOpenModel {
    throw new Error('getModel not supported!');
  }

  /**
   * A good default sort implementation for quick open entries respecting highlight information
   * as well as associated resources.
   */
  private compareEntries(elementA: QuickOpenEntry, elementB: QuickOpenEntry, lookFor: string): number {

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

  private toOpenModel(lookFor: string, items: QuickOpenItem[], actionProvider?: QuickOpenActionProvider): QuickOpenModel {
    const entries: QuickOpenEntry[] = [];
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

    return new QuickOpenModel(entries, actionProvider ? new MonacoQuickOpenActionProvider(actionProvider) : undefined);
  }

  protected createEntry(item: QuickOpenItem, lookFor: string): QuickOpenEntry | undefined {
    const { fuzzyMatchLabel, fuzzyMatchDescription, fuzzyMatchDetail } = this.options;
    // 自动匹配若为空，取自定义的匹配
    const labelHighlights = fuzzyMatchLabel ? this.matchesFuzzy(lookFor, item.getLabel(), fuzzyMatchLabel, item.getLabelHighlights.bind(item)) : item.getLabelHighlights();
    const descriptionHighlights = this.options.fuzzyMatchDescription ? this.matchesFuzzy(lookFor, item.getDescription(), fuzzyMatchDescription) : item.getDescriptionHighlights();
    const detailHighlights = this.options.fuzzyMatchDetail ? this.matchesFuzzy(lookFor, item.getDetail(), fuzzyMatchDetail) : item.getDetailHighlights();
    if ((lookFor && !labelHighlights && !descriptionHighlights && (!detailHighlights || detailHighlights.length === 0))
      && !this.options.showItemsWithoutHighlight) {
      return undefined;
    }
    const entry = item instanceof QuickOpenGroupItem ? new MonacoQuickOpenEntryGroup(item, this.keybindingRegistry) : new MonacoQuickOpenEntry(item, this.keybindingRegistry);
    entry.setHighlights(labelHighlights || [], descriptionHighlights, detailHighlights);
    return entry;
  }

  protected matchesFuzzy(lookFor: string, value: string | undefined, options?: QuickOpenOptions.FuzzyMatchOptions | boolean, fallback?: () => IHighlight[]): IHighlight[] | undefined {
    if (!lookFor || !value) {
      return [];
    }
    const enableSeparateSubstringMatching = typeof options === 'object' && options.enableSeparateSubstringMatching;
    const res = matchesFuzzy(lookFor, value, enableSeparateSubstringMatching) || undefined;
    if (res && res.length) {
      return res;
    }
    return fallback && fallback();
  }

  getAutoFocus(lookFor: string): IAutoFocus {
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

export class MonacoQuickOpenEntry extends QuickOpenEntry {

  constructor(
    public readonly item: QuickOpenItem,
    protected keybindingRegistry: KeybindingRegistry,
  ) {
    super();
  }

  getLabel(): string | undefined {
    return this.item.getLabel();
  }

  getAriaLabel(): string {
    return this.item.getTooltip()!;
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

  getKeybinding(): ResolvedKeybinding | undefined {
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

  run(mode: Mode, context: IEntryRunContext): boolean {
    if (mode === Mode.OPEN) {
      return this.item.run(Mode.OPEN);
    }
    if (mode === Mode.OPEN_IN_BACKGROUND) {
      return this.item.run(Mode.OPEN_IN_BACKGROUND);
    }
    if (mode === Mode.PREVIEW) {
      return this.item.run(Mode.PREVIEW);
    }
    return false;
  }

}

export class MonacoQuickOpenEntryGroup extends QuickOpenEntryGroup {

  constructor(
    public readonly item: QuickOpenGroupItem,
    protected keybindingRegistry: KeybindingRegistry,
  ) {
    super(new MonacoQuickOpenEntry(item, keybindingRegistry));
  }

  getGroupLabel(): string {
    return this.item.getGroupLabel() || '';
  }

  showBorder(): boolean {
    return this.item.showBorder();
  }

  getKeybinding(): ResolvedKeybinding | undefined {
    // FIXME: access private property from parent class
    const entry = this['entry'];
    return entry ? entry.getKeybinding() : super.getKeybinding();
  }

}
