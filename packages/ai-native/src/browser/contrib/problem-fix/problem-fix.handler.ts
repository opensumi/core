import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { AppConfig } from '@opensumi/ide-core-browser';
import { CancellationToken, Disposable, ProblemFixRegistryToken } from '@opensumi/ide-core-common';
import { Range } from '@opensumi/ide-monaco';
import {
  HoverParticipantRegistry,
  IEditorHoverRenderContext,
} from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/hover/browser/hoverTypes';
import {
  MarkerHover,
  MarkerHoverParticipant,
} from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/hover/browser/markerHoverParticipant';

import { IAIMonacoContribHandler } from '../base';

import { MarkerHoverParticipantComponent } from './problem-fix.component';
import { ProblemFixProviderRegistry } from './problem-fix.feature.registry';
import { ProblemFixService } from './problem-fix.service';

class AIMonacoHoverParticipant extends MarkerHoverParticipant {
  static injector: Injector;

  override renderHoverParts(context: IEditorHoverRenderContext, hoverParts: MarkerHover[]) {
    const disposable = super.renderHoverParts(context, hoverParts);

    const { fragment } = context;
    MarkerHoverParticipantComponent.mount(fragment, hoverParts, AIMonacoHoverParticipant.injector.get(AppConfig));

    return disposable;
  }
}

@Injectable()
export class ProblemFixHandler extends IAIMonacoContribHandler {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(ProblemFixService)
  private readonly problemFixService: ProblemFixService;

  @Autowired(ProblemFixRegistryToken)
  private readonly problemFixProviderRegistry: ProblemFixProviderRegistry;

  doContribute() {
    const disposable = new Disposable();

    // 先去掉 monaco 默认的 MarkerHoverParticipant
    HoverParticipantRegistry._participants = HoverParticipantRegistry._participants.filter(
      (participant) => participant !== MarkerHoverParticipant,
    );

    AIMonacoHoverParticipant.injector = this.injector;
    HoverParticipantRegistry.register(AIMonacoHoverParticipant);

    disposable.addDispose(
      this.problemFixService.onHoverFixTrigger((part) => {
        this.handleHoverFix(part);
      }),
    );

    return disposable;
  }

  private async handleHoverFix(part: MarkerHover) {
    const provider = this.problemFixProviderRegistry.getHoverFixProvider();
    if (!provider) {
      return;
    }

    const monacoEditor = this.editor?.monacoEditor;

    if (!monacoEditor) {
      return;
    }

    const model = monacoEditor.getModel();
    const context = {
      marker: part.marker,
      // 以 marker 的 range 为中心，向上取 2 行，向下取 3 行
      editRange: new Range(
        Math.max(part.range.startLineNumber - 2, 0),
        1,
        Math.min(part.range.endLineNumber + 3, model!.getLineCount() ?? 0),
        model!.getLineMaxColumn(part.range.endLineNumber + 3) ?? 0,
      ),
    };

    provider.provideFix(monacoEditor, context, CancellationToken.None);
  }
}
