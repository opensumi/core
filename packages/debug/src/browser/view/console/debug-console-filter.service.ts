import { Injectable } from '@ali/common-di';
import { Emitter, Event } from '@ali/ide-core-browser';
import { DebugConsoleFilterModel } from './debug-console-filter.model';
import { AnsiConsoleNode, DebugConsoleNode, DebugConsoleVariableContainer, DebugVariableContainer } from '../../tree';
const Ansi = require('anser');

export interface IDebugConsoleFilter<T> {
  filter: (treeNode: T) => boolean;
}

@Injectable()
export class DebugConsoleFilterService
  implements IDebugConsoleFilter<DebugConsoleNode | AnsiConsoleNode | DebugConsoleVariableContainer> {
  private readonly filterModel: DebugConsoleFilterModel;

  constructor() {
    this.filterModel = new DebugConsoleFilterModel();
  }

  private readonly _onDidValueChange: Emitter<string> = new Emitter<string>();
  get onDidValueChange(): Event<string> {
    return this._onDidValueChange.event;
  }

  private _filterText: string = '';

  public get filterText(): string {
    return this._filterText;
  }

  public setFilterText(v: string): this {
    if (this._filterText !== v) {
      this._filterText = v;
      this.filterModel.filterQuery = this._filterText;
      this._onDidValueChange.fire(this._filterText);
    }
    return this;
  }

  public filter(treeNode: DebugConsoleNode | AnsiConsoleNode | DebugVariableContainer): boolean {
    const ansiToText = Ansi.ansiToText(treeNode.description);
    return this._filterText === '' || this.filterModel.filter(ansiToText);
  }
}
