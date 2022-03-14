import { Injectable, Autowired } from '@opensumi/di';
import { IDisposable, Disposable } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { EditorComponentRegistry } from '@opensumi/ide-editor/lib/browser';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';

import { IRunTimeParams, AbstractSumiBrowserContributionRunner, IEditorSideViewContribution } from '../types';

@Injectable({ multiple: true })
export class EditorSideBrowserContributionRunner extends AbstractSumiBrowserContributionRunner {
  @Autowired(EditorComponentRegistry)
  editorComponentRegistry: EditorComponentRegistry;

  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorServiceImpl;

  run(param: IRunTimeParams): IDisposable {
    const disposer = new Disposable();
    const editorSide = this.contribution.editorSide;

    if (editorSide) {
      editorSide.view.forEach((component) => {
        disposer.addDispose(this.registerEditorSideComponent(component, param));
      });
    }

    return disposer;
  }

  registerEditorSideComponent(viewContribution: IEditorSideViewContribution, runParam: IRunTimeParams): IDisposable {
    const disposer = new Disposable();
    const { extendProtocol, extendService } = runParam.getExtensionExtendService(this.extension, viewContribution.id);

    disposer.addDispose(
      this.editorComponentRegistry.registerEditorSideWidget({
        id: viewContribution.id,
        side: viewContribution.side,
        component: viewContribution.component,
        initialProps: {
          kaitianExtendService: extendService,
          kaitianExtendSet: extendProtocol,
          sumiExtendService: extendService,
          sumiExtendSet: extendProtocol,
        },
        displaysOnResource: () => this.editorService.editorContextKeyService.match(viewContribution?.when),
      }),
    );

    return disposer;
  }
}
