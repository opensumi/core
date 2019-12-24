import { IRunParam, IKaitianBrowserContributions, AbstractKaitianBrowserContributionRunner, IEditorComponentContribution } from '../types';
import { IDisposable, Disposable, URI } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { IExtension } from '../../../common';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { getIcon } from '@ali/ide-core-browser';
import { IIconService } from '@ali/ide-theme';
import { ResourceService } from '@ali/ide-editor';
import { EditorComponentRegistry } from '@ali/ide-editor/lib/browser';

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

  run(param: IRunParam): IDisposable {
    const disposer = new Disposable();

    if (this.contribution.editor) {
      this.contribution.editor.component.forEach((component) => {
        disposer.addDispose(this.registerEditorComponent(component, param));
      });
    }

    return disposer;

  }

  registerEditorComponent(component: IEditorComponentContribution, runParam: IRunParam): IDisposable {
    const disposer = new Disposable();
    const { extendProtocol, extendService } = runParam.getExtensionExtendService(this.extension, component.id);
    const scheme = component.scheme || 'file';
    disposer.addDispose(this.editorComponentRegistry.registerEditorComponent({
      uid: component.id,
      scheme,
      component: component.panel,
      renderMode: component.renderMode,
    }, {
      kaitianExtendService: extendService,
      kaitianExtendSet: extendProtocol,
    }));

    if (scheme === 'file') {
      disposer.addDispose(this.editorComponentRegistry.registerEditorComponentResolver(scheme, (resource, results) => {
        let shouldShow = false;
        // 旧fileExt处理
        if ((component.fileExt && component.fileExt.indexOf(resource.uri.path.ext) > -1)) {
          if (!component.shouldPreview) {
            return;
          }
          const shouldPreview = component.shouldPreview(resource.uri.path);
          if (shouldPreview) {
            shouldShow = true;
          }
        }
        // handles处理
        if (component.handles ) {
          if (component.handles(resource.uri.codeUri)) {
            shouldShow = true;
          }
        }
        if (shouldShow) {
          results.push({
            type: 'component',
            componentId: component.id,
            title: component.title || '预览',
            weight: component.priority || 10,
          });
        }
      }));
    } else {
      disposer.addDispose(this.editorComponentRegistry.registerEditorComponentResolver(scheme, (resource, results) => {
        if (component.handles ) {
          if (!component.handles(resource.uri.codeUri)) {
            return;
          }
        }
        results.push({
          type: 'component',
          componentId: component.id,
          title: component.title || component.id,
          weight: component.priority || 10,
        });
      }));
    }
    if (!this.resourceService.handlesScheme(scheme)) {
      this.resourceService.registerResourceProvider({
        scheme,
        provideResource: (uri: URI) => {
          return {
            uri,
            name: component.tabTitle || component.id,
            icon: component.tabIconPath ? this.iconService.fromIcon(this.extension.path, component.tabIconPath)! : '',
          };
        },
      });
    }
    return disposer;
  }

}
