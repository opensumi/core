import { Injectable } from '@opensumi/di';
import { AI_CODE_ACTION } from '@opensumi/ide-core-browser/lib/ai-native/command';
import { AIActionItem } from '@opensumi/ide-core-browser/lib/components/ai-native/index';
import { Disposable, Emitter, IRange } from '@opensumi/ide-core-common';
import { CodeAction } from '@opensumi/ide-monaco';

@Injectable()
export class CodeActionService extends Disposable {
  private codeActionsMap = new Map<string, CodeAction>();

  private readonly _onCodeActionRun = new Emitter<{
    id: string;
    range: IRange;
  }>();
  public readonly onCodeActionRun = this._onCodeActionRun.event;

  override dispose() {
    super.dispose();
    this.codeActionsMap.clear();
  }

  public fireCodeActionRun(id: string, range: IRange) {
    this._onCodeActionRun.fire({ id, range });
  }

  public getCodeActions(): CodeAction[] {
    return Array.from(this.codeActionsMap.values());
  }

  public deleteCodeActionById(id: string): void {
    this.codeActionsMap.delete(id);
  }

  public registerCodeAction(operational: AIActionItem): void {
    const { codeAction, id } = operational;

    if (!codeAction) {
      return;
    }

    const action = {
      title: codeAction.title || operational.name,
      isAI: true,
      isPreferred: codeAction.isPreferred ?? true,
      kind: codeAction.kind || 'InlineChat',
      disabled: codeAction.disabled,
      command: {
        id: AI_CODE_ACTION.id,
        title: codeAction.title || operational.name,
        arguments: [operational.id],
      },
    } as CodeAction;

    this.codeActionsMap.set(id, action);
  }
}
