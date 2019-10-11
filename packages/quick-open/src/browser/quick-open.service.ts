import { KeySequence, KeybindingRegistry } from '@ali/ide-core-browser';
import { MessageType, MarkerSeverity } from '@ali/ide-core-common';
import { QuickOpenMode, QuickOpenModel, QuickOpenItem, QuickOpenGroupItem, QuickOpenService, QuickOpenOptions, HideReason } from './quick-open.model';
import { Injectable, Autowired } from '@ali/common-di';
import { MonacoResolvedKeybinding } from '@ali/ide-monaco/lib/browser/monaco.resolved-keybinding';

export interface MonacoQuickOpenControllerOpts extends monaco.quickOpen.IQuickOpenControllerOpts {
  readonly prefix?: string;
  readonly password?: boolean;
  ignoreFocusOut?: boolean;
  onType?(lookFor: string, acceptor: (model: monaco.quickOpen.QuickOpenModel) => void): void;
  onClose?(canceled: boolean): void;
}

@Injectable()
export class MonacoQuickOpenService implements QuickOpenService {

  protected _widget: monaco.quickOpen.QuickOpenWidget | undefined;
  protected opts: MonacoQuickOpenControllerOpts;

  @Autowired(KeybindingRegistry)
  protected keybindingRegistry: KeybindingRegistry;

  open(model: QuickOpenModel, options?: Partial<QuickOpenOptions.Resolved> | undefined): void {
    this.internalOpen(new MonacoQuickOpenModel(model, this.keybindingRegistry, options));
  }

  hide(reason?: HideReason): void {
    this.widget.hide(reason);
  }

  internalOpen(opts: MonacoQuickOpenControllerOpts): void {
    this.opts = opts;
    const widget = this.widget;
    widget.show(this.opts.prefix || '');

    this.setPlaceHolder(opts.inputAriaLabel);
    this.setPassword(opts.password ? true : false);
  }

  protected get widget(): monaco.quickOpen.QuickOpenWidget {
    if (this._widget) {
      return this._widget;
    }
    const overlayWidgets = document.createElement('div');
    overlayWidgets.classList.add('quick-open-overlay');
    document.body.appendChild(overlayWidgets);

    const container = document.createElement('quick-open-container');
    container.style.position = 'absolute';
    container.style.top = '0px';
    container.style.right = '50%';
    overlayWidgets.appendChild(container);

    this._widget = new monaco.quickOpen.QuickOpenWidget(container, {
      onOk: () => this.onClose(false),
      onCancel: () => this.onClose(true),
      onType: (lookFor) => this.onType(lookFor || ''),
      onFocusLost: () => this.onFocusLost(),
    }, {});
    this.attachQuickOpenStyler();
    this._widget.create();
    return this._widget;
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

  onClose(cancelled: boolean): void {
    this.options.onClose(cancelled);
  }

  onType(lookFor: string, acceptor: (model: monaco.quickOpen.QuickOpenModel) => void): void {
    this.model.onType(lookFor, (items) => {
        const result = this.toOpenModel(lookFor, items);
        acceptor(result);
    });
  }

  getModel(lookFor: string): monaco.quickOpen.QuickOpenModel {
    throw new Error('getModel not supported!');
  }

  private toOpenModel(lookFor: string, items: QuickOpenItem[]): monaco.quickOpen.QuickOpenModel {
    const entries: monaco.quickOpen.QuickOpenEntry[] = [];
    for (const item of items) {
        const entry = this.createEntry(item, lookFor);
        if (entry) {
            entries.push(entry);
        }
    }
    if (this.options.fuzzySort) {
        entries.sort((a, b) => monaco.quickOpen.compareEntries(a, b, lookFor));
    }
    return new monaco.quickOpen.QuickOpenModel(entries);
}

  protected createEntry(item: QuickOpenItem, lookFor: string): monaco.quickOpen.QuickOpenEntry | undefined {
    if (this.options.skipPrefix) {
      lookFor = lookFor.substr(this.options.skipPrefix);
    }
    const { fuzzyMatchLabel, fuzzyMatchDescription, fuzzyMatchDetail } = this.options;
    const labelHighlights = fuzzyMatchLabel ? this.matchesFuzzy(lookFor, item.getLabel(), fuzzyMatchLabel) : item.getLabelHighlights();
    const descriptionHighlights = this.options.fuzzyMatchDescription ? this.matchesFuzzy(lookFor, item.getDescription(), fuzzyMatchDescription) : item.getDescriptionHighlights();
    const detailHighlights = this.options.fuzzyMatchDetail ? this.matchesFuzzy(lookFor, item.getDetail(), fuzzyMatchDetail) : item.getDetailHighlights();
    if ((lookFor && !labelHighlights && !descriptionHighlights && !detailHighlights)) {
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
