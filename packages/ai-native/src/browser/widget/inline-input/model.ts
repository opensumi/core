import { InteractiveInput } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { MaybePromise, uuid } from '@opensumi/ide-core-common';
import { ICodeEditor, IPosition, Selection } from '@opensumi/ide-monaco';

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

export class InlineInputWidgetStoreInEmptyLine {
  constructor(private position: IPosition, private value?: string) {}

  public getPosition(): IPosition {
    return this.position;
  }

  public setPosition(position: IPosition): void {
    this.position = position;
  }

  public getValue(): string | undefined {
    return this.value;
  }

  public setValue(value: string): void {
    this.value = value;
  }
}

export class InlineInputWidgetStoreInSelection {
  constructor(private selection: Selection, private value?: string) {}

  public getSelection(): Selection {
    return this.selection;
  }

  public setSelection(selection: Selection): void {
    this.selection = selection;
  }

  public getValue(): string | undefined {
    return this.value;
  }

  public setValue(value: string): void {
    this.value = value;
  }
}
