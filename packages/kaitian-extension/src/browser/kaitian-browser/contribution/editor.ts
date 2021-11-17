import { IRunTimeParams, AbstractKaitianBrowserContributionRunner, IEditorViewContribution } from '../types';
import { IDisposable, Disposable, URI } from '@ide-framework/ide-core-common';
import { Injectable, Autowired } from '@ide-framework/common-di';
import { IMainLayoutService } from '@ide-framework/ide-main-layout';
import { IIconService, IconType } from '@ide-framework/ide-theme';
import { ResourceService } from '@ide-framework/ide-editor';
import { EditorComponentRegistry } from '@ide-framework/ide-editor/lib/browser';

@Injectable({multiple: true})
export class EditorBrowserContributionRunner extends AbstractKaitianBrowserContributionRunner {

  @Autowired(IMainLayoutService)
  layoutService: IMainLayoutService;

  @Autowired(ResourceService)
  resourceService: ResourceService;

  @Autowired(EditorComponentRegistry)
  editorComponentRegistry: EditorComponentRegistry;

  @Autowired(IIconService)
  iconService: IIconService;

  run(param: IRunTimeParams): IDisposable {
    const disposer = new Disposable();

    if (this.contribution.editor) {
      this.contribution.editor.view.forEach((component) => {
        disposer.addDispose(this.registerEditorComponent(component, param));
      });
    }

    return disposer;

  }

  registerEditorComponent(viewContribution: IEditorViewContribution, runParam: IRunTimeParams): IDisposable {
    const disposer = new Disposable();
    const { extendProtocol, extendService } = runParam.getExtensionExtendService(this.extension, viewContribution.id);
    const scheme = viewContribution.scheme || 'file';
    disposer.addDispose(this.editorComponentRegistry.registerEditorComponent({
      uid: viewContribution.id,
      scheme,
      component: viewContribution.component,
      renderMode: viewContribution.renderMode,
    }, {
      kaitianExtendService: extendService,
      kaitianExtendSet: extendProtocol,
    }));

    if (scheme === 'file') {
      disposer.addDispose(this.editorComponentRegistry.registerEditorComponentResolver(scheme, (resource, results) => {
        let shouldShow = false;
        // 旧fileExt处理
        if ((viewContribution.fileExt && viewContribution.fileExt.indexOf(resource.uri.path.ext) > -1)) {
          if (!viewContribution.shouldPreview) {
            return;
          }
          const shouldPreview = viewContribution.shouldPreview(resource.uri.path);
          if (shouldPreview) {
            shouldShow = true;
          }
        }
        // handles处理
        if (viewContribution.handles ) {
          if (viewContribution.handles(resource.uri.codeUri)) {
            shouldShow = true;
          }
        }
        if (shouldShow) {
          results.push({
            type: 'component',
            componentId: viewContribution.id,
            title: viewContribution.title || '预览',
            weight: viewContribution.priority || 10,
          });
        }
      }));
    } else {
      disposer.addDispose(this.editorComponentRegistry.registerEditorComponentResolver(scheme, (resource, results) => {
        if (viewContribution.handles ) {
          if (!viewContribution.handles(resource.uri.codeUri)) {
            return;
          }
        }
        results.push({
          type: 'component',
          componentId: viewContribution.id,
          title: viewContribution.title || viewContribution.id,
          weight: viewContribution.priority || 10,
        });
      }));
    }
    this.resourceService.registerResourceProvider({
      scheme,
      provideResource: (uri: URI) => {
        return {
          uri,
          name: viewContribution.tabTitle || viewContribution.id,
          icon: viewContribution.tabIconPath ? this.iconService.fromIcon(this.extension.path, viewContribution.tabIconPath, IconType.Background)! : '',
        };
      },
    });
    return disposer;
  }

}
