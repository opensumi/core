import { Autowired, Injectable, Optional } from '@opensumi/di';
import {
  CancellationToken,
  Disposable,
  IDisposable,
  IntelligentCompletionsRegistryToken,
} from '@opensumi/ide-core-common';
import { ICodeEditor, ICursorPositionChangedEvent, IPosition, Position } from '@opensumi/ide-monaco';
import { URI } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { StandaloneServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';
import {
  IMarker,
  IMarkerService,
  IRelatedInformation,
  MarkerSeverity,
} from '@opensumi/monaco-editor-core/esm/vs/platform/markers/common/markers';

import { IntelligentCompletionsRegistry } from './intelligent-completions.feature.registry';

import { ECodeEditsSource } from '.';

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
export class LintErrorCodeEditsSource extends Disposable {
  @Autowired(IntelligentCompletionsRegistryToken)
  private readonly intelligentCompletionsRegistry: IntelligentCompletionsRegistry;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  private get model() {
    return this.monacoEditor.getModel();
  }

  constructor(
    @Optional() private readonly monacoEditor: ICodeEditor,
    @Optional() private readonly token: CancellationToken,
  ) {
    super();
  }

  public mount(): IDisposable {
    let prePosition = this.monacoEditor.getPosition();

    this.addDispose(
      // 仅在光标的行号发生变化时，才触发
      this.monacoEditor.onDidChangeCursorPosition((event: ICursorPositionChangedEvent) => {
        const currentPosition = event.position;
        if (prePosition && prePosition.lineNumber !== currentPosition.lineNumber) {
          this.doTrigger(currentPosition);
        }
        prePosition = currentPosition;
      }),
    );
    return this;
  }

  private async doTrigger(position: Position) {
    if (!this.model) {
      return;
    }

    const markerService = StandaloneServices.get(IMarkerService);
    const resource = this.model.uri;

    let markers = markerService.read({ resource, severities: MarkerSeverity.Error });
    markers = markers.filter((marker) => Math.abs(marker.startLineNumber - position.lineNumber) <= 1);

    if (markers.length) {
      const provider = this.intelligentCompletionsRegistry.getCodeEditsProvider();
      if (provider) {
        const relativeWorkspacePath = await this.workspaceService.asRelativePath(resource.path);
        provider(
          this.monacoEditor,
          position,
          {
            typing: ECodeEditsSource.LinterErrors,
            data: {
              relativeWorkspacePath: relativeWorkspacePath?.path ?? resource.path,
              errors: markers.map((marker) => MarkerErrorData.toData(marker)),
            },
          },
          this.token,
        );
      }
    }
  }
}
