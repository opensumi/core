import React from 'react';
import ReactDOM from 'react-dom';

import { Autowired, Injectable, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import {
  AppConfig,
  compareAnything,
  ConfigProvider,
  IContextKey,
  IContextKeyService,
  KeybindingRegistry,
  QuickOpenActionProvider,
  QuickOpenTabOptions,
} from '@opensumi/ide-core-browser';
import { VALIDATE_TYPE } from '@opensumi/ide-core-browser/lib/components';
import {
  HideReason,
  Highlight,
  QuickOpenItem,
  QuickOpenModel as IKaitianQuickOpenModel,
  QuickOpenOptions,
  QuickOpenService,
} from '@opensumi/ide-core-browser/lib/quick-open';
import { MonacoContextKeyService } from '@opensumi/ide-monaco/lib/browser/monaco.context-key.service';
import { matchesFuzzy } from '@opensumi/monaco-editor-core/esm/vs/base/common/filters';

import { IAutoFocus, IQuickOpenModel, QuickOpenContext } from './quick-open.type';
import { QuickOpenView } from './quick-open.view';
import { QuickOpenWidget } from './quick-open.widget';

export interface IKaitianQuickOpenControllerOpts extends QuickOpenTabOptions {
  inputAriaLabel: string;
  getAutoFocus(searchValue: string): IAutoFocus;
  valueSelection?: [number, number];
  enabled?: boolean;
  readonly prefix?: string;
  readonly password?: boolean;
  ignoreFocusOut?: boolean;
  canSelectMany?: boolean;
  onType?(lookFor: string, acceptor: (model: IQuickOpenModel) => void): void;
  onClose?(canceled: boolean): void;
  onSelect?(item: QuickOpenItem, index: number): void;
  onConfirm?(items: QuickOpenItem[]): void;
  onChangeValue?(lookFor: string): void;
}

@Injectable()
export class MonacoQuickOpenService implements QuickOpenService {
  protected _widget: QuickOpenWidget | undefined;
  protected opts: IKaitianQuickOpenControllerOpts;
  protected container: HTMLElement;
  protected previousActiveElement: Element | undefined;

  @Autowired(KeybindingRegistry)
  protected keybindingRegistry: KeybindingRegistry;

  @Autowired(MonacoContextKeyService)
  protected readonly monacoContextKeyService: MonacoContextKeyService;

  @Autowired(IContextKeyService)
  protected readonly contextKeyService: IContextKeyService;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  private preLookFor = '';

  get inQuickOpenContextKey(): IContextKey<boolean> {
    return this.contextKeyService.createKey<boolean>('inQuickOpen', false);
  }

  private appendQuickOpenContainer() {
    const overlayContainer = document.querySelector('#ide-overlay');

    if (!overlayContainer) {
      throw new Error('ide-overlay is requried');
    }

    const overlayWidgets = document.createElement('div');
    overlayWidgets.classList.add('quick-open-overlay');
    overlayContainer.appendChild(overlayWidgets);

    const container = (this.container = document.createElement('quick-open-container'));
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

  protected internalOpen(opts: IKaitianQuickOpenControllerOpts): void {
    this.opts = opts;
    const widget = this.widget;

    widget.show(this.opts.prefix || '', {
      placeholder: opts.inputAriaLabel,
      password: opts.password,
      inputEnable: opts.enabled ?? true,
      valueSelection: opts.valueSelection,
      canSelectMany: opts.canSelectMany,
      renderTab: opts.renderTab,
      toggleTab: opts.toggleTab,
    });

    this.inQuickOpenContextKey.set(true);
  }

  refresh(): void {
    this.onType(this.widget.inputValue);
  }

  public get widget(): QuickOpenWidget {
    if (this._widget) {
      return this._widget;
    }
    this.appendQuickOpenContainer();
    this._widget = this.injector.get(QuickOpenWidget, [
      {
        onOk: () => {
          this.previousActiveElement = undefined;
          this.onClose(false);
        },
        onCancel: () => {
          if (this.previousActiveElement instanceof HTMLElement) {
            this.previousActiveElement.focus();
          }
          this.previousActiveElement = undefined;
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
        onHide: () => {
          this.inQuickOpenContextKey.set(false);
        },
        onSelect: (item: QuickOpenItem, index: number) => {
          if (this.opts.onSelect) {
            this.opts.onSelect(item, index);
          }
        },
        onConfirm: (items: QuickOpenItem[]) => {
          if (this.opts.onConfirm) {
            this.opts.onConfirm(items);
          }
        },
      },
    ]);
    this.initWidgetView(this._widget);
    return this._widget;
  }

  private initWidgetView(widget: QuickOpenWidget) {
    // 因为 quickopen widget 需要通过构造函数初始化，无法通过 useInjectable 获取实例
    // 但其实是一个单例对象，使用 React Context 让其子组件获取到 widget 实例
    ReactDOM.render(
      <ConfigProvider value={this.appConfig}>
        <QuickOpenContext.Provider value={{ widget }}>
          <QuickOpenView />
        </QuickOpenContext.Provider>
      </ConfigProvider>,
      this.container,
    );
  }

  protected onClose(cancelled: boolean): void {
    this.opts.onClose?.(cancelled);
  }

  protected async onType(lookFor: string): Promise<void> {
    const options = this.opts;
    if (this.widget && options.onType) {
      options.onType(lookFor, (model) => {
        // 触发 onchange 事件
        if (this.preLookFor !== lookFor && this.opts.onChangeValue) {
          this.opts.onChangeValue(lookFor);
        }
        this.preLookFor = lookFor;
        return this.widget.setInput(model, options.getAutoFocus(lookFor), options.inputAriaLabel);
      });
    }
  }

  protected onFocusLost(): boolean {
    return !!this.opts.ignoreFocusOut;
  }

  showDecoration(type: VALIDATE_TYPE): void {
    this.widget.validateType = type;
  }

  hideDecoration(): void {
    this.widget.validateType = undefined;
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

  get valueSelection(): [number, number] | undefined {
    return this.options.valueSelection;
  }

  get renderTab() {
    return this.options.renderTab;
  }

  get toggleTab() {
    return this.options.toggleTab;
  }

  get canSelectMany() {
    return this.options.canPickMany;
  }

  onClose(cancelled: boolean): void {
    this.options.onClose(cancelled);
  }

  onSelect(item: QuickOpenItem, index: number) {
    this.options.onSelect(item, index);
  }

  onConfirm(items: QuickOpenItem[]) {
    this.options.onConfirm(items);
  }

  onType(lookFor: string, acceptor: (model: IQuickOpenModel) => void): void {
    this.model.onType(lookFor, (items, actionProvider) => {
      const result = this.toOpenModel(lookFor, items, actionProvider);
      acceptor(result);
    });
  }

  /**
   * A good default sort implementation for quick open entries respecting highlight information
   * as well as associated resources.
   */
  private compareEntries(elementA: QuickOpenItem, elementB: QuickOpenItem, lookFor: string): number {
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

  private toOpenModel(
    lookFor: string,
    items: QuickOpenItem[],
    actionProvider?: QuickOpenActionProvider,
  ): IQuickOpenModel {
    const originLookFor = lookFor;

    if (this.options.skipPrefix) {
      lookFor = lookFor.substr(this.options.skipPrefix);
    }

    if (actionProvider && actionProvider.getValidateInput) {
      lookFor = actionProvider.getValidateInput(lookFor);
    }
    // 在此过滤 item
    const entries: QuickOpenItem[] = items.filter((item) => !!this.fuzzyQuickOpenItem(item, lookFor));

    if (this.options.fuzzySort) {
      entries.sort((a, b) => this.compareEntries(a, b, lookFor));
    }

    const { getPlaceholderItem } = this.options;
    if (!entries.length && getPlaceholderItem) {
      entries.push(getPlaceholderItem(lookFor, originLookFor));
    }
    return {
      items: entries,
      actionProvider,
    };
  }

  protected fuzzyQuickOpenItem(item: QuickOpenItem, lookFor: string): QuickOpenItem | undefined {
    const { fuzzyMatchLabel, fuzzyMatchDescription, fuzzyMatchDetail } = this.options;
    // 自动匹配若为空，取自定义的匹配
    const labelHighlights = fuzzyMatchLabel
      ? this.matchesFuzzy(lookFor, item.getLabel(), fuzzyMatchLabel, item.getLabelHighlights.bind(item))
      : item.getLabelHighlights();

    const descriptionHighlights = this.options.fuzzyMatchDescription
      ? this.matchesFuzzy(lookFor, item.getDescription(), fuzzyMatchDescription)
      : item.getDescriptionHighlights();

    const detailHighlights = this.options.fuzzyMatchDetail
      ? this.matchesFuzzy(lookFor, item.getDetail(), fuzzyMatchDetail)
      : item.getDetailHighlights();

    if (
      lookFor &&
      !labelHighlights &&
      !descriptionHighlights &&
      (!detailHighlights || detailHighlights.length === 0) &&
      !this.options.showItemsWithoutHighlight
    ) {
      return undefined;
    }
    item.setHighlights(labelHighlights || [], descriptionHighlights, detailHighlights);
    return item;
  }

  protected matchesFuzzy(
    lookFor: string,
    value: string | undefined,
    options?: QuickOpenOptions.FuzzyMatchOptions | boolean,
    fallback?: () => Highlight[] | undefined,
  ): Highlight[] | undefined {
    if (!lookFor || !value) {
      return [];
    }
    const enableSeparateSubstringMatching = typeof options === 'object' && options.enableSeparateSubstringMatching;
    const res = matchesFuzzy(lookFor, value, enableSeparateSubstringMatching) || undefined;
    if (res && res.length) {
      return res;
    }
    const fallbackRes = fallback && fallback();
    if (fallbackRes && fallbackRes.length) {
      return fallbackRes;
    }
    return undefined;
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
