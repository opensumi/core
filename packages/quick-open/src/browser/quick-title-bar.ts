import { StaticResourceService } from '@ali/ide-static-resource/lib/browser';
import { Emitter, Event, URI, DisposableCollection } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';

import { QuickTitleButton, QuickTitleButtonSide } from '@ali/ide-core-browser/lib/quick-open';
import './quick-title-bar.less';
import { IThemeService } from '@ali/ide-theme';

@Injectable()
export class QuickTitleBar {
  @Autowired(IThemeService)
  public themeService: IThemeService;

  @Autowired()
  protected staticResourceService: StaticResourceService;

  private readonly onDidTriggerButtonEmitter: Emitter<QuickTitleButton>;
  private _isAttached: boolean;

  private titleElement: HTMLElement;
  private titleBarContainer: HTMLElement;
  private attachedNode: HTMLElement | undefined;

  private _title: string | undefined;
  private _step: number | undefined;
  private _totalSteps: number | undefined;
  private _buttons: ReadonlyArray<QuickTitleButton> = [];

  private tabIndex = 2; // Keep track of the tabIndex for the buttons

  private disposableCollection: DisposableCollection;
  constructor() {
    this.titleElement = document.createElement('div');
    this.titleElement.className = QuickTitleBar.Styles.QUICK_TITLE_HEADER;

    this.onDidTriggerButtonEmitter = new Emitter();

    this.disposableCollection = new DisposableCollection();
    this.disposableCollection.push(this.onDidTriggerButtonEmitter = new Emitter());
  }

  get onDidTriggerButton(): Event<QuickTitleButton> {
    return this.onDidTriggerButtonEmitter.event;
  }

  get isAttached(): boolean {
    return this._isAttached;
  }

  set isAttached(isAttached: boolean) {
    this._isAttached = isAttached;
  }

  set title(title: string | undefined) {
    this._title = title;
    this.updateInnerTitleText();
  }

  get title(): string | undefined {
    return this._title;
  }

  set step(step: number | undefined) {
    this._step = step;
    this.updateInnerTitleText();
  }

  get step(): number | undefined {
    return this._step;
  }

  set totalSteps(totalSteps: number | undefined) {
    this._totalSteps = totalSteps;
    this.updateInnerTitleText();
  }

  get totalSteps(): number | undefined {
    return this._totalSteps;
  }

  set buttons(buttons: ReadonlyArray<QuickTitleButton>) {
    if (buttons === undefined) {
      this._buttons = [];
      return;
    }

    this._buttons = buttons;
  }

  get buttons(): ReadonlyArray<QuickTitleButton> {
    return this._buttons.map((_, idx) => (Object.assign({}, _, { handler: idx })));
  }

  private updateInnerTitleText(): void {
    let innerTitle = '';

    if (this.title) {
      innerTitle = this.title + ' ';
    }

    if (this.step && this.totalSteps) {
      innerTitle += `(${this.step}/${this.totalSteps})`;
    } else if (this.step) {
      innerTitle += this.step;
    }

    this.titleElement.innerText = innerTitle;
  }

  // Left buttons are for the buttons derived from QuickInputButtons
  private getLeftButtons(): ReadonlyArray<QuickTitleButton> {
    if (this.buttons === undefined || this.buttons.length === 0) {
      return [];
    }
    return this.buttons.filter((btn) => btn.side === QuickTitleButtonSide.LEFT);
  }

  private getRightButtons(): ReadonlyArray<QuickTitleButton> {

    if (this.buttons === undefined || this.buttons.length === 0) {
      return [];
    }
    return this.buttons.filter((btn) => btn.side === QuickTitleButtonSide.RIGHT || typeof btn.side === 'undefined');
  }

  private iconPath2URI(iconPath): URI | undefined {
    if (URI.isUri(iconPath)) {
      return iconPath;
    }

    if (iconPath.dark || iconPath.light) {
      return this.themeService.currentThemeId === 'ide-dark'
        ? new URI(iconPath.dark.toString())
        : new URI(iconPath.light.toString());
    }
  }

  private createButtonElements(buttons: ReadonlyArray<QuickTitleButton>): HTMLSpanElement[] {
    return buttons.map((btn) => {

      const spanElement = document.createElement('span');
      spanElement.className = QuickTitleBar.Styles.QUICK_TITLE_BUTTON;
      spanElement.tabIndex = 0;

      if (btn.iconClass) {
        spanElement.classList.add(...btn.iconClass.split(' '));
      }

      if (btn?.iconPath) {
        const iconUri = this.iconPath2URI(btn.iconPath);
        iconUri && (btn.icon = this.staticResourceService.resolveStaticResource(iconUri).toString());
      }

      if (btn.icon !== '') {
        spanElement.style.backgroundImage = `url(\'${btn.icon}\')`;
      }

      spanElement.classList.add('kt-clickable-icon');
      spanElement.tabIndex = this.tabIndex;
      spanElement.title = btn.tooltip ? btn.tooltip : '';

      spanElement.onclick = () => {
        this.onDidTriggerButtonEmitter.fire(btn);
      };
      spanElement.onkeyup = (event) => {
        if (event.code === 'Enter') {
          spanElement.click();
        }
      };
      this.tabIndex += 1;
      return spanElement;
    });
  }

  private createTitleBarDiv(): HTMLDivElement {
    const div = document.createElement('div');
    div.className = QuickTitleBar.Styles.QUICK_TITLE_CONTAINER;
    div.onclick = (event) => {
      event.stopPropagation();
      event.preventDefault();
    };
    return div;
  }

  private createLeftButtonDiv(): HTMLDivElement {
    const leftButtonDiv = document.createElement('div'); // Holds all the buttons that get added to the left
    leftButtonDiv.className = QuickTitleBar.Styles.QUICK_TITLE_LEFT_BAR;

    this.createButtonElements(this.getLeftButtons()).forEach((btn) => leftButtonDiv.appendChild(btn));
    return leftButtonDiv;
  }

  private createRightButtonDiv(): HTMLDivElement {
    const rightButtonDiv = document.createElement('div');
    rightButtonDiv.className = QuickTitleBar.Styles.QUICK_TITLE_RIGHT_BAR;
    this.createButtonElements(this.getRightButtons()).forEach((btn) => rightButtonDiv.appendChild(btn));
    return rightButtonDiv;
  }

  // eslint-disable-next-line max-len
  public attachTitleBar(widgetNode: HTMLElement, title: string | undefined, step: number | undefined, totalSteps: number | undefined, buttons: ReadonlyArray<QuickTitleButton> | undefined): void {
    const div = this.createTitleBarDiv();

    this.updateInnerTitleText();

    this.title = title;
    this.step = step;
    this.totalSteps = totalSteps;

    if (buttons) {
      this._buttons = buttons;
    }

    div.appendChild(this.createLeftButtonDiv());
    div.appendChild(this.titleElement);
    div.appendChild(this.createRightButtonDiv());

    if (widgetNode.contains(this.titleBarContainer)) {
      widgetNode.removeChild(this.titleBarContainer);
    }
    widgetNode.prepend(div);

    this.titleBarContainer = div;
    this.attachedNode = widgetNode;
    this.isAttached = true;
  }

  hide(): void {
    this.title = undefined;
    this.buttons = [];
    this.step = undefined;
    this.totalSteps = undefined;
    this.isAttached = false;
    if (this.attachedNode && this.attachedNode.contains(this.titleBarContainer)) {
      this.attachedNode.removeChild(this.titleBarContainer);
    }
    this.attachedNode = undefined;
  }

  shouldShowTitleBar(title: string | undefined, step: number | undefined): boolean {
    return ((title !== undefined) || (step !== undefined));
  }

  dispose() {
    this.disposableCollection.dispose();
  }

}

export namespace QuickTitleBar {
  export namespace Styles {
    export const QUICK_TITLE_CONTAINER = 'quick-title-container';
    export const QUICK_TITLE_LEFT_BAR = 'quick-title-left-bar';
    export const QUICK_TITLE_RIGHT_BAR = 'quick-title-right-bar';
    export const QUICK_TITLE_HEADER = 'quick-title-header';
    export const QUICK_TITLE_BUTTON = 'quick-title-button';
  }
}
