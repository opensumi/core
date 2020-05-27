import { Injectable, Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Domain, CommandService, MutableResource } from '@ali/ide-core-common';
import { ComponentContribution, ComponentRegistry, ClientAppContribution, getIcon, SlotRendererContribution, SlotRendererRegistry, SlotLocation, ResourceResolverContribution, URI } from '@ali/ide-core-browser';
import { NextMenuContribution, IMenuRegistry } from '@ali/ide-core-browser/lib/menu/next';
import { ResourceService, IResource } from '@ali/ide-editor/lib/common';
import { EditorComponentRegistry, IEditorDocumentModelContentRegistry, BrowserEditorContribution } from '@ali/ide-editor/lib/browser';
import { EDITOR_COMMANDS } from '@ali/ide-core-browser';

import { SampleView, SampleTopView, SampleBottomView, SampleMainView } from './sample.view';
import { RightTabRenderer } from './custom-renderer';
import { AntcodeResourceProvider, SampleResourceProvider } from './sample-doc';
import { FileDocContentProvider, AntcodeDocContentProvider } from './sample-file-doc';
import { toSCMUri } from '../modules/uri';

@Injectable()
@Domain(CommandContribution, NextMenuContribution, ComponentContribution, ClientAppContribution, SlotRendererContribution, ResourceResolverContribution, BrowserEditorContribution)
export class SampleContribution implements CommandContribution, NextMenuContribution, ComponentContribution, ClientAppContribution, SlotRendererContribution, ResourceResolverContribution, BrowserEditorContribution {

  @Autowired(CommandService)
  private commandService: CommandService;

  registerEditorDocumentModelContentProvider(registry: IEditorDocumentModelContentRegistry) {
    // 注册 provider 提供 doc / 文档的内容和 meta 信息
    registry.registerEditorDocumentModelContentProvider(new FileDocContentProvider());
    registry.registerEditorDocumentModelContentProvider(new AntcodeDocContentProvider());
  }

  registerEditorComponent(editorComponentRegistry: EditorComponentRegistry) {
    // 处理 file 协议的 editor component type
    editorComponentRegistry.registerEditorComponentResolver('file', (resource: IResource, results) => {
      results.push({
        type: 'code',
      });
    });

    // 处理 antcode 协议的 editor component type
    editorComponentRegistry.registerEditorComponentResolver('antcode', (resource: IResource, results) => {
      results.push({
        type: 'code',
      });
    });
  }

  registerResource(resourceService: ResourceService) {
    resourceService.registerResourceProvider(new SampleResourceProvider());
    resourceService.registerResourceProvider(new AntcodeResourceProvider());
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
    this.commandService.executeCommand(
      EDITOR_COMMANDS.OPEN_RESOURCE.id,
      toSCMUri({
        platform: process.env.SCM_PLATFORM!,
        repo: 'taian.lta/TypeScript-Node-Starter',
        path: '/src/app.ts',
        ref: '511a03ea248e1ace8532abebc7abdba3c55cb641',
      }),
      { forceOpenType: { type: 'code' } },
    );

    this.commandService.executeCommand(
      EDITOR_COMMANDS.OPEN_RESOURCE.id,
      toSCMUri({
        platform: process.env.SCM_PLATFORM!,
        repo: 'taian.lta/TypeScript-Node-Starter',
        path: '/src/models/User.ts',
        ref: '511a03ea248e1ace8532abebc7abdba3c55cb641',
      }),
      { forceOpenType: { type: 'code' } },
    );

    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, URI.file('test1.js'), { forceOpenType: { type: 'code' } });
    // this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, URI.from(Uri.parse('git://user/test.js')));
  }
}
