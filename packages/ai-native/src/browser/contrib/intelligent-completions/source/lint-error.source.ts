import { Injectable } from '@opensumi/di';
import { AINativeSettingSectionsId, ECodeEditsSourceTyping, IDisposable } from '@opensumi/ide-core-common';
import { ICursorPositionChangedEvent, IPosition, Position } from '@opensumi/ide-monaco';
import { URI } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import { autorunDelta, observableFromEvent } from '@opensumi/ide-monaco/lib/common/observable';
import { StandaloneServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';
import {
  IMarker,
  IMarkerService,
  IRelatedInformation,
  MarkerSeverity,
} from '@opensumi/monaco-editor-core/esm/vs/platform/markers/common/markers';

import { BaseCodeEditsSource } from './base';

export interface ILinterErrorData {
  errors: Array<IMarkerErrorData>;
}

export interface IMarkerErrorData {
  message: string;
  range: {
    startPosition: IPosition;
    endPosition: IPosition;
  };
  source: URI;
  severity: string;
  relatedInformation?: IRelatedInformation[];
}

namespace MarkerErrorData {
  export function toData(marker: IMarker): IMarkerErrorData {
    return {
      message: marker.message,
      range: {
        startPosition: {
          lineNumber: marker.startLineNumber,
          column: marker.startColumn,
        },
        endPosition: {
          lineNumber: marker.endLineNumber,
          column: marker.endColumn,
        },
      },
      source: marker.resource,
      relatedInformation: marker.relatedInformation,
      severity: MarkerSeverity.toString(marker.severity),
    };
  }
}

@Injectable({ multiple: true })
export class LintErrorCodeEditsSource extends BaseCodeEditsSource {
  public priority = 0;

  public mount(): IDisposable {
    const positionChangeObs = observableFromEvent<ICursorPositionChangedEvent>(
      this,
      this.monacoEditor.onDidChangeCursorPosition,
      (event: ICursorPositionChangedEvent) => event,
    );

    this.addDispose(
      autorunDelta(positionChangeObs, ({ lastValue, newValue }) => {
        const prePosition = lastValue?.position;
        const currentPosition = newValue?.position;

        // 如果是 selection 则不触发
        const selection = this.monacoEditor.getSelection();
        if (!selection?.isEmpty()) {
          return;
        }

        // 仅在光标的行号发生变化时，才触发
        if (prePosition && prePosition.lineNumber !== currentPosition?.lineNumber) {
          this.doTrigger(currentPosition);
        }
      }),
    );
    return this;
  }

  protected doTrigger(position: Position) {
    const isLintErrorsEnabled = this.preferenceService.getValid(AINativeSettingSectionsId.CodeEditsLintErrors, false);

    if (!isLintErrorsEnabled || !this.model) {
      return;
    }

    const markerService = StandaloneServices.get(IMarkerService);
    const resource = this.model.uri;

    let markers = markerService.read({ resource, severities: MarkerSeverity.Error });
    markers = markers.filter((marker) => Math.abs(marker.startLineNumber - position.lineNumber) <= 1);

    if (markers.length) {
      this.setBean({
        typing: ECodeEditsSourceTyping.LinterErrors,
        data: {
          [ECodeEditsSourceTyping.LinterErrors]: {
            errors: markers.map((marker) => MarkerErrorData.toData(marker)),
          },
        },
      });
    }
  }
}
