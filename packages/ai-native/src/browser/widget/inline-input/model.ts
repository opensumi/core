import { InteractiveInput } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { MaybePromise, uuid } from '@opensumi/ide-core-common';
import { ICodeEditor } from '@opensumi/ide-monaco';

import { ERunStrategy, IInteractiveInputHandler } from '../../types';

type TRunStrategyFn = (editor: ICodeEditor, value: string) => MaybePromise<ERunStrategy>;

export class InteractiveInputModel {
  static ID: string = `${InteractiveInput.displayName}:${uuid(4)}`;

  private _handler: IInteractiveInputHandler | undefined;
  private _strategyHandler: TRunStrategyFn;

  public setHandler(h: IInteractiveInputHandler): void {
    this._handler = h;
  }

  public handler(): IInteractiveInputHandler | undefined {
    return this._handler;
  }

  public setStrategyHandler(fn: TRunStrategyFn): void {
    this._strategyHandler = fn;
  }

  public strategyHandler(): TRunStrategyFn {
    return this._strategyHandler;
  }

  public dispose(): void {
    this._handler = undefined;
  }
}
