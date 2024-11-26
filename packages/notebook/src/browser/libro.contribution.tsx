import {
  ISettings,
  LibroJupyterNoEditorModule,
  ServerConnection,
  ServerManager,
} from '@difizen/libro-jupyter/noeditor';
import { LibroTOCModule } from '@difizen/libro-toc';
import { Container, ManaAppPreset, ManaComponents, ThemeService } from '@difizen/mana-app';
import React, { useState } from 'react';

import { Autowired, Injector } from '@opensumi/di';
import {
  AppConfig,
  ClientAppContextContribution,
  ClientAppContribution,
  CommandContribution,
  type CommandRegistry,
  ComponentContribution,
  ComponentRegistry,
  Disposable,
  Domain,
  IClientApp,
  IOpenerService,
  OpenerContribution,
  Schemes,
  URI,
  localize,
} from '@opensumi/ide-core-browser';
import { message } from '@opensumi/ide-core-browser/lib/components';
import {
  BrowserEditorContribution,
  EditorComponentRegistry,
  INotebookService,
  IResource,
  ResourceService,
  WorkbenchEditorService,
} from '@opensumi/ide-editor/lib/browser';
import { IEditorDocumentModelContentRegistry } from '@opensumi/ide-editor/lib/browser/doc-model/types';
import { IconService } from '@opensumi/ide-theme/lib/browser';
import { IThemeService, IconType } from '@opensumi/ide-theme/lib/common';

import { KERNEL_PANEL_ID, KernelPanel, initKernelPanelColorToken } from './kernel-panel';
import { LibroOpensumiModule } from './libro';
import { LibroOpener } from './libro-opener';
import { initLibroColorToken } from './libro.color.tokens';
import { LIBRO_COMPONENTS_ID, LIBRO_COMPONENTS_SCHEME_ID } from './libro.protocol';
import { OpensumiLibroView } from './libro.view';
import { ManaContainer, initLibroOpensumi, manaContainer } from './mana/index';
import { NotebookDocumentContentProvider } from './notebook-document-content-provider';
import { NotebookServiceOverride } from './notebook.service';
import { initTocPanelColorToken } from './toc';
import { LibroVariableModule } from './variables/libro-variable-module';
import { VariablePanel } from './variables/variable-panel';
import { VARIABLE_ID } from './variables/variable-protocol';

const LIBRO_COMPONENTS_VIEW_COMMAND = {
  id: 'opensumi-libro',
};

const LayoutWrapper: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  return (
    <ManaComponents.Application
      context={{ container: manaContainer }}
      modules={[ManaAppPreset, LibroJupyterNoEditorModule, LibroTOCModule, LibroOpensumiModule, LibroVariableModule]}
      renderChildren
      onReady={() => setIsReady(true)}
    >
      {isReady ? children : 'loading'}
    </ManaComponents.Application>
  );
};

export const NOTE_BOOK_PANNEL_ID = 'notebook-pannel';

@Domain(
  ClientAppContribution,
  BrowserEditorContribution,
  ClientAppContextContribution,
  CommandContribution,
  OpenerContribution,
  ComponentContribution,
)
export class LibroContribution
  extends Disposable
  implements
    ClientAppContribution,
    BrowserEditorContribution,
    ClientAppContextContribution,
    CommandContribution,
    OpenerContribution,
    ComponentContribution
{
  @Autowired(ManaContainer)
  private readonly manaContainer: Container;

  @Autowired(IconService)
  protected readonly iconService: IconService;

  @Autowired(WorkbenchEditorService)
  protected readonly editorService: WorkbenchEditorService;

  @Autowired(IThemeService)
  protected readonly themeService: IThemeService;

  @Autowired(INotebookService)
  protected readonly notebookService: NotebookServiceOverride;

  @Autowired(NotebookDocumentContentProvider)
  protected readonly notebookDocumentContentProvider: NotebookDocumentContentProvider;

  @Autowired(LibroOpener)
  protected readonly libroOpener: LibroOpener;

  @Autowired(AppConfig)
  config: AppConfig;

  private serverManagerInited = false;

  registerOpener(registry: IOpenerService): void {
    registry.registerOpener(this.libroOpener);
  }

  initialize(app: IClientApp) {
    initLibroOpensumi(app.injector, manaContainer);
  }

  registerComponent(registry: ComponentRegistry) {
    const iconClass = this.iconService.fromIcon(
      '',
      {
        dark: 'https://mdn.alipayobjects.com/huamei_rm3rgy/afts/img/A*tFyaRbqux_4AAAAAAAAAAAAADr2GAQ/original',
        light: 'https://mdn.alipayobjects.com/huamei_rm3rgy/afts/img/A*ebL7T4dWefUAAAAAAAAAAAAADr2GAQ/original',
      },
      IconType.Background,
    );
    registry.register(
      '@opensumi/ide-notebook',
      [
        {
          id: KERNEL_PANEL_ID,
          name: localize('notebook.kernel.panel.title'),
          component: KernelPanel,
          priority: 0,
        },
        {
          id: VARIABLE_ID,
          name: localize('notebook.variable.panel.title'),
          weight: 2,
          priority: 1,
          component: VariablePanel,
        },
      ],
      {
        activateKeyBinding: 'ctrlcmd+shift+k',
        containerId: NOTE_BOOK_PANNEL_ID,
        iconClass,
      },
    );
  }

  registerClientAppContext(Layout: React.FC, injector: Injector): React.FC {
    initLibroColorToken();
    initKernelPanelColorToken();
    initTocPanelColorToken();
    return () => (
      <LayoutWrapper>
        <Layout />
      </LayoutWrapper>
    );
  }

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand(LIBRO_COMPONENTS_VIEW_COMMAND, {
      execute: () => {
        this.editorService.open(new URI(`${LIBRO_COMPONENTS_SCHEME_ID}://`), {
          preview: false,
        });
      },
    });
  }

  registerEditorComponent(registry: EditorComponentRegistry) {
    registry.registerEditorComponent({
      uid: LIBRO_COMPONENTS_ID,
      scheme: LIBRO_COMPONENTS_SCHEME_ID,
      component: OpensumiLibroView,
    });

    registry.registerEditorComponentResolver(Schemes.file, (resource, results) => {
      if (resource.uri.path.ext === `.${LIBRO_COMPONENTS_SCHEME_ID}`) {
        // 首次打开 notebook 文件时初始化 jupyter 服务连接
        if (!this.serverManagerInited && this.config.notebookServerHost) {
          this.serverManagerInited = true;
          // 目前直接从浏览器连接 jupyter 服务，对服务的cors等配置会有要求
          this.connectJupyterServer(this.config.notebookServerHost).catch((err) => message.error(err.message));
        }
        results.push({
          type: 'component',
          componentId: LIBRO_COMPONENTS_ID,
        });
      }
    });
  }

  registerEditorDocumentModelContentProvider(registry: IEditorDocumentModelContentRegistry) {
    registry.registerEditorDocumentModelContentProvider(this.notebookDocumentContentProvider);
  }

  registerResource(service: ResourceService) {
    service.registerResourceProvider({
      scheme: LIBRO_COMPONENTS_SCHEME_ID,
      provideResource: async (uri: URI): Promise<IResource<any>> => {
        const iconClass = this.iconService.fromIcon(
          '',
          'https://mdn.alipayobjects.com/huamei_xt20ge/afts/img/A*LDFvSptm_zgAAAAAAAAAAAAADiuUAQ/original',
          IconType.Background,
        );
        return {
          uri,
          name: 'notebook',
          icon: iconClass!,
        };
      },
    });
  }

  async onDidStart() {
    this.addDispose(this.notebookService.listenLibro());
    this.addDispose(this.notebookService.listenEditor());

    const manaThemeService = this.manaContainer.get(ThemeService);
    const curTheme = await this.themeService.getCurrentTheme();
    manaThemeService.setCurrentTheme(curTheme.type);
    this.addDispose(
      this.themeService.onThemeChange((theme) => {
        manaThemeService.setCurrentTheme(theme.type);
      }),
    );
  }

  protected async connectJupyterServer(serverHost: string) {
    const libroServerConnection = this.manaContainer.get(ServerConnection);
    const token = this.config.notebookServerToken;
    const setting: Partial<ISettings> =
      window.location.protocol === 'https:'
        ? {
            baseUrl: `https://${serverHost}/`,
            wsUrl: `wss://${serverHost}/`,
          }
        : {
            baseUrl: `http://${serverHost}/`,
            wsUrl: `ws://${serverHost}/`,
          };

    libroServerConnection.updateSettings({ ...setting, token });
    const serverManager = this.manaContainer.get(ServerManager);
    await serverManager.launch();
  }
}
