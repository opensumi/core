import { Injectable } from '@opensumi/di';
import { AINativeSettingSectionsId, ECodeEditsSourceTyping, IDisposable } from '@opensumi/ide-core-common';
import { ICursorPositionChangedEvent, IModelContentChangedEvent } from '@opensumi/ide-monaco';
import {
  autorunDelta,
  derived,
  derivedHandleChanges,
  observableFromEvent,
  onObservableChange,
} from '@opensumi/ide-monaco/lib/common/observable';

import { IntelligentCompletionsController } from '../intelligent-completions.controller';

import { BaseCodeEditsSource } from './base';

export interface ILineChangeData {
  currentLineNumber: number;
  preLineNumber?: number;
}

const DEPRECATED_LIMIT = 5;
const CONTENT_CHANGE_VALID_TIME = 60 * 1000;

@Injectable({ multiple: true })
export class LineChangeCodeEditsSource extends BaseCodeEditsSource {
  public priority = 1;

  /**
   * 在当前文件，计算弃用上次 edit 时的次数是否超过了阈值 {@link DEPRECATED_LIMIT} 次，超过则不会触发
   * 1. 直接 esc 弃用
   * 2. 用户再次移动光标位置致使补全消失也视为弃用
   */
  private readonly deprecatedStore = new Map<string, number>();

  private readonly positionChangeObs = observableFromEvent<ICursorPositionChangedEvent>(
    this,
    this.monacoEditor.onDidChangeCursorPosition,
    (event: ICursorPositionChangedEvent) => event,
  );

  private readonly contentChangeObs = observableFromEvent<IModelContentChangedEvent>(
    this,
    this.monacoEditor.onDidChangeModelContent,
    (event: IModelContentChangedEvent) => event,
  );

  private readonly latestContentChangeTimeObs = derivedHandleChanges(
    {
      owner: this,
      createEmptyChangeSummary: () => ({ latestContentChangeTime: 0 }),
      handleChange: (context, changeSummary) => {
        if (context.didChange(this.contentChangeObs)) {
          changeSummary.latestContentChangeTime = Date.now();
        }
        return true;
      },
    },
    (reader, changeSummary) => {
      this.contentChangeObs.read(reader);
      return changeSummary.latestContentChangeTime;
    },
  );

  private readonly isAllowTriggerObs = derived((reader) => {
    this.positionChangeObs.read(reader);
    const latestContentChangeTime = this.latestContentChangeTimeObs.read(reader);

    const isLineChangeEnabled = this.preferenceService.getValid(AINativeSettingSectionsId.CodeEditsLineChange, false);

    /**
     * 配置开关
     */
    if (!isLineChangeEnabled) {
      return false;
    }

    /**
     * 弃用次数规则的限制
     */
    const deprecatedCount = this.deprecatedStore.get(this.model?.id || '');
    if (deprecatedCount && deprecatedCount >= DEPRECATED_LIMIT) {
      return false;
    }

    /**
     * 1. 未编辑过代码不触发
     * 2. 编辑过代码后，60 内没有再次编辑也不触发
     */
    if (
      latestContentChangeTime === 0 ||
      (latestContentChangeTime && Date.now() - latestContentChangeTime > CONTENT_CHANGE_VALID_TIME)
    ) {
      return false;
    }

    return true;
  });

  public mount(): IDisposable {
    this.addDispose(
      autorunDelta(this.positionChangeObs, ({ lastValue, newValue }, reader) => {
        const isAllowTriggerObs = this.isAllowTriggerObs.read(reader);
        if (!isAllowTriggerObs) {
          return false;
        }

        const prePosition = lastValue?.position;
        const currentPosition = newValue?.position;
        if (prePosition && prePosition.lineNumber !== currentPosition?.lineNumber) {
          this.setBean({
            typing: ECodeEditsSourceTyping.LineChange,
            data: {
              [ECodeEditsSourceTyping.LineChange]: {
                preLineNumber: prePosition.lineNumber,
                currentLineNumber: currentPosition.lineNumber,
              },
            },
          });
        }
      }),
    );

    const discard = IntelligentCompletionsController.get(this.monacoEditor)?.discard;
    const accept = IntelligentCompletionsController.get(this.monacoEditor)?.accept;
    if (discard) {
      this.addDispose(
        onObservableChange(discard, (isValid: boolean) => {
          const modelId = this.model?.id;
          if (!modelId || !isValid) {
            return;
          }

          const count = this.deprecatedStore.get(modelId) || 0;
          this.deprecatedStore.set(modelId, count + 1);
        }),
      );
    }

    if (accept) {
      this.addDispose(
        onObservableChange(accept, () => {
          const modelId = this.model?.id;
          if (!modelId) {
            return;
          }

          this.deprecatedStore.delete(modelId);
        }),
      );
    }

    return this;
  }
}
