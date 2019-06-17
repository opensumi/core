import { KeySequence, KeybindingRegistry } from '@ali/ide-core-browser';
import { QuickOpenMode, QuickOpenModel, QuickOpenItem, QuickOpenGroupItem } from './quick-open.model';
import { Injectable, Autowired } from '@ali/common-di';

export type QuickOpenOptions = Partial<QuickOpenOptions.Resolved>;
export namespace QuickOpenOptions {
  export interface Resolved {
    readonly prefix: string;
    readonly placeholder: string;
    onClose(canceled: boolean): void;

    readonly fuzzyMatchLabel: boolean;
    readonly fuzzyMatchDetail: boolean;
    readonly fuzzyMatchDescription: boolean;
    readonly fuzzySort: boolean;
  }
  export const defaultOptions: Resolved = Object.freeze({
    prefix: '',
    placeholder: '',
    onClose: () => { /* no-op*/ },
    fuzzyMatchLabel: false,
    fuzzyMatchDetail: false,
    fuzzyMatchDescription: false,
    fuzzySort: false,
  });
  export function resolve(options: QuickOpenOptions = {}, source: Resolved = defaultOptions): Resolved {
    return Object.assign({}, source, options);
  }
}

export const QuickOpenService = Symbol('QuickOpenService');

export interface QuickOpenService {
  open(model: QuickOpenModel, options?: QuickOpenOptions): void;
}

export interface InternalMonacoQuickOpenModel extends monaco.quickOpen.IQuickOpenControllerOpts {
  readonly prefix?: string;
  onClose?(canceled: boolean): void;
}

@Injectable()
export class MonacoQuickOpenService implements QuickOpenService {

  protected _widget: monaco.quickOpen.QuickOpenWidget | undefined;
  protected model: InternalMonacoQuickOpenModel | undefined;

  @Autowired(KeybindingRegistry)
  protected keybindingRegistry: KeybindingRegistry;

  open(model: QuickOpenModel, options?: Partial<QuickOpenOptions.Resolved> | undefined): void {
    this.internalOpen(new MonacoQuickOpenModel(model, this.keybindingRegistry, options));
  }

  internalOpen(model: InternalMonacoQuickOpenModel): void {
    this.model = model;
    const widget = this.widget;
    widget.show(this.model.prefix || '');
    this.setPlaceHolder(model.inputAriaLabel);
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
      onFocusLost: () => false,
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
    if (this.model && this.model.onClose) {
      this.model.onClose(cancelled);
    }
  }

  protected onType(lookFor: string): void {
    const options = this.model;
    if (this.widget && options) {
      this.widget.setInput(options.getModel(lookFor), options.getAutoFocus(lookFor), options.inputAriaLabel);
    }
  }
}

export class MonacoQuickOpenModel implements InternalMonacoQuickOpenModel {

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
    return this.options.placeholder;
  }

  onClose(cancelled: boolean): void {
    this.options.onClose(cancelled);
  }

  getModel(lookFor: string): monaco.quickOpen.QuickOpenModel {
    const entries: monaco.quickOpen.QuickOpenEntry[] = [];
    const items = this.model.getItems(lookFor);
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
    const labelHighlights = this.options.fuzzyMatchLabel ? this.matchesFuzzy(lookFor, item.getLabel()) : item.getLabelHighlights();
    if (!labelHighlights) {
      return undefined;
    }
    const descriptionHighlights = this.options.fuzzyMatchDescription ? this.matchesFuzzy(lookFor, item.getDescription()) : item.getDescriptionHighlights();
    const detailHighlights = this.options.fuzzyMatchDetail ? this.matchesFuzzy(lookFor, item.getDetail()) : item.getDetailHighlights();

    const entry = item instanceof QuickOpenGroupItem ? new QuickOpenEntryGroup(item, this.keybindingRegistry) : new QuickOpenEntry(item, this.keybindingRegistry);
    entry.setHighlights(labelHighlights, descriptionHighlights, detailHighlights);
    return entry;
  }

  protected matchesFuzzy(lookFor: string, value: string | undefined): monaco.quickOpen.IHighlight[] | undefined {
    if (!lookFor || !value) {
      return [];
    }
    return monaco.filters.matchesFuzzy(lookFor, value);
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
    // return {
    //   getAriaLabel: () => keybinding.keyCode.label,
    //   getParts: () => [new monaco.keybindings.ResolvedKeybindingPart(
    //     keybinding.keyCode.ctrl,
    //     keybinding.keyCode.shift,
    //     keybinding.keyCode.alt,
    //     keybinding.keyCode.meta,
    //     keybinding.keyCode.key,
    //     keybinding.keyCode.key,
    //   ), undefined],
    // };
  }

  run(mode: monaco.quickOpen.Mode): boolean {
    if (mode === monaco.quickOpen.Mode.OPEN) {
      return this.item.run(QuickOpenMode.OPEN);
    }
    if (mode === monaco.quickOpen.Mode.OPEN_IN_BACKGROUND) {
      return this.item.run(QuickOpenMode.OPEN_IN_BACKGROUND);
    }
    if (mode === monaco.quickOpen.Mode.PREVIEW) {
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

}
