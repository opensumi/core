import { Injectable, Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Domain, CommandService, MutableResource } from '@ali/ide-core-common';
import { ComponentContribution, ComponentRegistry, ClientAppContribution, getIcon, SlotRendererContribution, SlotRendererRegistry, SlotLocation, ResourceResolverContribution, URI } from '@ali/ide-core-browser';
import { NextMenuContribution, IMenuRegistry } from '@ali/ide-core-browser/lib/menu/next';
import { ResourceService, IResource } from '@ali/ide-editor/lib/common';
import { EditorComponentRegistry, IEditorDocumentModelContentRegistry, BrowserEditorContribution } from '@ali/ide-editor/lib/browser';

import { SampleView, SampleTopView, SampleBottomView, SampleMainView } from './sample.view';
import { RightTabRenderer } from './custom-renderer';
import { SampleDocContentProvider, SampleResourceProvider } from './sample-doc';

@Injectable()
@Domain(CommandContribution, NextMenuContribution, ComponentContribution, ClientAppContribution, SlotRendererContribution, ResourceResolverContribution, BrowserEditorContribution)
export class SampleContribution implements CommandContribution, NextMenuContribution, ComponentContribution, ClientAppContribution, SlotRendererContribution, ResourceResolverContribution, BrowserEditorContribution {

  @Autowired(CommandService)
  private commandService: CommandService;

  registerEditorDocumentModelContentProvider(registry: IEditorDocumentModelContentRegistry) {
    // 注册 provider 提供 doc / 文档的内容和 meta 信息
    registry.registerEditorDocumentModelContentProvider(new SampleDocContentProvider());
  }

  registerEditorComponent(editorComponentRegistry: EditorComponentRegistry) {
    // 处理 file 协议的 editor component type
    editorComponentRegistry.registerEditorComponentResolver('file', (resource: IResource, results) => {
      results.push({
        type: 'code',
      });
    });
  }

  registerResource(resourceService: ResourceService) {
    resourceService.registerResourceProvider(new SampleResourceProvider());
  }

  registerCommands(registry: CommandRegistry) {

  }

  async resolve(uri: URI): Promise<MutableResource | void> {
    if (uri.scheme !== 'file') {
      return;
    }
    const resource = new MutableResource(uri, 'test string content', () => { });
    return resource;
  }

  registerNextMenus(menuRegistry: IMenuRegistry) {

  }

  registerRenderer(registry: SlotRendererRegistry) {
    registry.registerSlotRenderer(SlotLocation.right, RightTabRenderer);
  }

  // 注册视图和token的绑定关系
  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-dw', [
      {
        id: 'dw-view1',
        component: SampleView,
        name: 'dw手风琴视图1',
      },
      {
        id: 'dw-view2',
        component: SampleView,
        name: 'dw手风琴视图2',
      },
    ], {
      containerId: 'ide-dw',
      title: 'Hello DW',
      priority: 10,
      iconClass: getIcon('explorer'),
    });

    registry.register('@ali/ide-dw-right', [
      {
        id: 'dw-view3',
        component: SampleView,
        name: 'dw手风琴视图3',
      },
      {
        id: 'dw-view4',
        component: SampleView,
        name: 'dw手风琴视图4',
      },
    ], {
      containerId: 'ide-dw-right',
      title: 'HelloDW2',
      priority: 10,
      iconClass: getIcon('debug'),
    });

    registry.register('@ali/ide-mock-top', {
      id: 'fake-top',
      component: SampleTopView,
    });

    registry.register('@ali/ide-mock-bottom', {
      id: 'fake-bottom',
      component: SampleBottomView,
    });

    registry.register('@ali/ide-mock-main', {
      id: 'fake-main',
      component: SampleMainView,
    });
  }

  async onDidStart() {
    this.commandService.executeCommand('editor.openUri', URI.file('/user/test.js'), { forceOpenType: { type: 'code' } });
  }

}
