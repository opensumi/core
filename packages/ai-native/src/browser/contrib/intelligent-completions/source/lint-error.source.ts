import { Autowired, Injectable } from '@opensumi/di';
import { ECodeEditsSourceTyping, Event, FRAME_THREE, IDisposable } from '@opensumi/ide-core-common';
import { ICursorPositionChangedEvent, IPosition, Position } from '@opensumi/ide-monaco';
import { URI } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { StandaloneServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';
import {
  IMarker,
  IMarkerService,
  IRelatedInformation,
  MarkerSeverity,
} from '@opensumi/monaco-editor-core/esm/vs/platform/markers/common/markers';

import { BaseCodeEditsSource } from './base';

export interface ILinterErrorData {
  relativeWorkspacePath: string;
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
  public priority = 1;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  public mount(): IDisposable {
    let prePosition = this.monacoEditor.getPosition();

    this.addDispose(
      // 仅在光标的行号发生变化时，才触发
      Event.debounce(
        this.monacoEditor.onDidChangeCursorPosition,
        (_, e) => e,
        FRAME_THREE,
      )(async (event: ICursorPositionChangedEvent) => {
        const currentPosition = event.position;

        // 如果是 selection 则不触发
        const selection = this.monacoEditor.getSelection();
        if (!selection?.isEmpty()) {
          return;
        }

        if (prePosition && prePosition.lineNumber !== currentPosition.lineNumber) {
          await this.doTrigger(currentPosition);
        }
        prePosition = currentPosition;
      }),
    );
    return this;
  }

  protected async doTrigger(position: Position) {
    if (!this.model) {
      return;
    }

    const markerService = StandaloneServices.get(IMarkerService);
    const resource = this.model.uri;

    let markers = markerService.read({ resource, severities: MarkerSeverity.Error });
    markers = markers.filter((marker) => Math.abs(marker.startLineNumber - position.lineNumber) <= 1);

    if (markers.length) {
      const relativeWorkspacePath = await this.workspaceService.asRelativePath(resource.path);

      this.setBean({
        typing: ECodeEditsSourceTyping.LinterErrors,
        position,
        data: {
          relativeWorkspacePath: relativeWorkspacePath?.path ?? resource.path,
          errors: markers.map((marker) => MarkerErrorData.toData(marker)),
        },
      });
    }
  }
}
