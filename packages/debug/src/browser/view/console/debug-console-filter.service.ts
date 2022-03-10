import { Injectable } from '@opensumi/di';
import { Emitter, Event } from '@opensumi/ide-core-browser';
import * as strings from '@opensumi/ide-core-common';

import { matchAll } from '../../debugUtils';

import { DebugConsoleFilterModel } from './debug-console-filter.model';

const Ansi = require('anser');

export interface IDebugConsoleFilter {
  filter: (t: string) => boolean;
}

export interface IFilterMatches {
  startIndex: number;
  count: number;
}

@Injectable()
export class DebugConsoleFilterService implements IDebugConsoleFilter {
  private readonly filterModel: DebugConsoleFilterModel;

  constructor() {
    this.filterModel = new DebugConsoleFilterModel();
  }

  private readonly _onDidValueChange: Emitter<string> = new Emitter<string>();
  get onDidValueChange(): Event<string> {
    return this._onDidValueChange.event;
  }

  private readonly _onDidFocus: Emitter<void> = new Emitter<void>();
  get onDidFocus(): Event<void> {
    return this._onDidFocus.event;
  }

  private _filterText = '';

  public focusInput(): void {
    this._onDidFocus.fire();
  }

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

  public filter(text: string): boolean {
    const ansiToText = Ansi.ansiToText(text);
    return this._filterText === '' || this.filterModel.filter(ansiToText);
  }

  public findMatches(text: string): IFilterMatches[] {
    const regexp = new RegExp(strings.convertSimple2RegExpPattern(this._filterText.toLowerCase()), 'g');
    if (this._filterText.trim() === '') {
      return [];
    }

    const matchs = matchAll(text.toLowerCase(), regexp);
    const textLen = this._filterText.length;
    if (textLen === 0) {
      return [];
    }

    const res: IFilterMatches[] = matchs.map((m) => ({
      startIndex: m.index !== undefined ? m.index : -1,
      count: textLen,
    }));

    return res.filter((r) => r.startIndex >= 0);
  }
}
