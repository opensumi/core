import { Injectable } from '@opensumi/di';
import { compare, Event, IDisposable } from '@opensumi/ide-core-common';
import { ITextModel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { LanguageFeatureRegistry } from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes/languageFeatureRegistry';

import { ILanguageStatusService, ILanguageStatus } from '../../common';


@Injectable()
export class LanguageStatusService implements ILanguageStatusService {
  private readonly _provider = new LanguageFeatureRegistry<ILanguageStatus>();

  readonly onDidChange: Event<any> = this._provider.onDidChange;

  addStatus(status: ILanguageStatus): IDisposable {
    return this._provider.register(status.selector, status);
  }

  getLanguageStatus(model: ITextModel): ILanguageStatus[] {
    return this._provider.ordered(model).sort((a, b) => {
      let res = b.severity - a.severity;
      if (res === 0) {
        res = compare(a.source, b.source);
      }
      if (res === 0) {
        res = compare(a.id, b.id);
      }
      return res;
    });
  }
}
