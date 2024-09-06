import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { AppConfig } from '@opensumi/ide-core-browser';
import { Disposable } from '@opensumi/ide-core-common';
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

class AIMonacoHoverParticipant extends MarkerHoverParticipant {
  static injector: Injector;

  override renderHoverParts(context: IEditorHoverRenderContext, hoverParts: MarkerHover[]) {
    const disposable = super.renderHoverParts(context, hoverParts);

    const { fragment } = context;
    MarkerHoverParticipantComponent.mount(fragment, AIMonacoHoverParticipant.injector.get(AppConfig));

    return disposable;
  }
}

@Injectable()
export class ProblemFixHandler extends IAIMonacoContribHandler {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  doContribute() {
    const disposable = new Disposable();

    // 先去掉 monaco 默认的 MarkerHoverParticipant
    HoverParticipantRegistry._participants = HoverParticipantRegistry._participants.filter(
      (participant) => participant !== MarkerHoverParticipant,
    );

    AIMonacoHoverParticipant.injector = this.injector;
    HoverParticipantRegistry.register(AIMonacoHoverParticipant);

    return disposable;
  }
}
