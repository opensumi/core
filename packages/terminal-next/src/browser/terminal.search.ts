import { Autowired, Injectable } from '@opensumi/di';
import { Emitter, Event, debounce } from '@opensumi/ide-core-common';

import {
  ITerminalClient,
  ITerminalController,
  ITerminalGroupViewService,
  ITerminalSearchService,
  IUIState,
} from '../common';

@Injectable()
export class TerminalSearchService implements ITerminalSearchService {
  protected _isVisible: boolean = false;

  public UIState: IUIState = {
    isMatchCase: false,
    isUseRegexp: false,
    isWholeWord: false,
  };

  get isVisible() {
    return this._isVisible;
  }
  set isVisible(value: boolean) {
    this._isVisible = value;
    this._onVisibleChange.fire(value);
  }

  @Autowired(ITerminalController)
  controller: ITerminalController;

  @Autowired(ITerminalGroupViewService)
  terminalView: ITerminalGroupViewService;

  protected _onVisibleChange = new Emitter<boolean>();
  onVisibleChange: Event<boolean> = this._onVisibleChange.event;

  get client(): ITerminalClient | undefined {
    return this.controller.findClientFromWidgetId(this.terminalView.currentWidget.get().id);
  }

  open() {
    this.isVisible = true;
  }

  get onResultChange() {
    return this.client?.onSearchResultsChange;
  }

  close() {
    this.client?.closeSearch();
    this.isVisible = false;
  }

  clear() {
    this.client?.closeSearch();
    this.text = '';
  }

  text = '';

  @debounce(150)
  search() {
    this.client?.findNext(this.text, {
      wholeWord: this.UIState.isWholeWord,
      regex: this.UIState.isUseRegexp,
      caseSensitive: this.UIState.isMatchCase,
    });
  }

  @debounce(150)
  searchPrevious() {
    this.client?.findPrevious(this.text, {
      wholeWord: this.UIState.isWholeWord,
      regex: this.UIState.isUseRegexp,
      caseSensitive: this.UIState.isMatchCase,
    });
  }

  @debounce(150)
  searchNext(): void {
    this.client?.findNext(this.text, {
      wholeWord: this.UIState.isWholeWord,
      regex: this.UIState.isUseRegexp,
      caseSensitive: this.UIState.isMatchCase,
    });
  }

  updateUIState(state: Partial<IUIState>): void {
    this.UIState = {
      ...this.UIState,
      ...state,
    };
    this.search();
  }
}
