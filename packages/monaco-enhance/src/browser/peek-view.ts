import { getExternalIcon } from '@opensumi/ide-core-browser';
import { IMenu } from '@opensumi/ide-core-browser/lib/menu/next';
import { Emitter, Disposable } from '@opensumi/ide-core-common';
import type { ICodeEditor } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';

import { IOptions, ZoneWidget } from './zone-widget';

export interface IPeekViewOptions extends IOptions {
  supportOnTitleClick?: boolean;
}

export abstract class PeekViewWidget extends ZoneWidget {
  private readonly _onDidClose = new Emitter<PeekViewWidget>();
  readonly onDidClose = this._onDidClose.event;

  private isDisposed?: true;

  protected _headElement?: HTMLDivElement;
  protected _primaryHeading?: HTMLElement;
  protected _secondaryHeading?: HTMLElement;
  protected _metaHeading?: HTMLElement;
  protected _actionbarElement?: HTMLDivElement;
  protected _bodyElement?: HTMLDivElement;

  constructor(protected readonly editor: ICodeEditor, readonly options: IPeekViewOptions = {}) {
    super(editor);
  }

  public override dispose(): void {
    if (!this.isDisposed) {
      this.isDisposed = true;
      super.dispose();
      this._onDidClose.fire(this);
    }
  }

  protected _fillContainer(container: HTMLElement): void {
    this.setCssClass('peekview-widget');

    this._headElement = document.createElement('div');
    this._headElement.classList.add('head');

    this._bodyElement = document.createElement('div');
    this._bodyElement.classList.add('body');

    this._fillHead(this._headElement);
    this._fillBody(this._bodyElement);

    container.appendChild(this._headElement);
    container.appendChild(this._bodyElement);
  }

  protected async _fillHead(container: HTMLElement, noCloseAction?: boolean): Promise<void> {
    const titleElement = document.createElement('div');
    titleElement.classList.add('peekview-title');

    if ((this.options as IPeekViewOptions).supportOnTitleClick) {
      titleElement.classList.add('clickable');
      // handle click event
    }
    this._headElement!.append(titleElement);

    this._fillTitleIcon(titleElement);

    this._primaryHeading = document.createElement('span');
    this._primaryHeading.classList.add('filename');

    this._secondaryHeading = document.createElement('span');
    this._secondaryHeading.classList.add('dirname');

    this._metaHeading = document.createElement('span');
    this._metaHeading.classList.add('meta');

    titleElement.append(this._primaryHeading, this._secondaryHeading, this._metaHeading);

    this._actionbarElement = document.createElement('div');
    this._actionbarElement.classList.add('peekview-actions');

    await this._fillActionBarOptions(this._actionbarElement);

    const closeIcon = document.createElement('span');
    closeIcon.className = `action-item ${getExternalIcon('chrome-close')}`;
    const listenCloseClick = () => this.dispose();

    closeIcon.addEventListener('click', listenCloseClick);
    this.addDispose(
      Disposable.create(() => {
        closeIcon.removeEventListener('click', listenCloseClick);
      }),
    );

    this._actionbarElement.append(closeIcon);

    this._headElement!.append(this._actionbarElement);
  }

  protected _fillTitleIcon(container: HTMLElement): void {}

  protected abstract _fillActionBarOptions(container: HTMLElement): Promise<void>;

  protected abstract _fillBody(container: HTMLElement): void;

  /**
   * 如果 supportOnTitleClick 为 true，则需要覆写该方法
   */
  protected _onTitleClick(event: MouseEvent): void {}

  public setTitle(primaryHeading: string, secondaryHeading?: string): void {
    if (this._primaryHeading && this._secondaryHeading) {
      this._primaryHeading.innerText = primaryHeading;
      this._primaryHeading.setAttribute('title', primaryHeading);
      if (secondaryHeading) {
        this._secondaryHeading.innerText = secondaryHeading;
      } else {
        while (this._secondaryHeading.firstChild) {
          this._secondaryHeading.firstChild.remove();
        }
      }
    }
  }

  public setMetaTitle(value: string): void {
    if (this._metaHeading) {
      if (value) {
        this._metaHeading.innerText = value;
        this._metaHeading.style.display = '';
      } else {
        this._metaHeading.style.display = 'none';
      }
    }
  }
}
