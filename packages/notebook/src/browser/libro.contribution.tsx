import { LibroJupyterNoEditorModule } from '@difizen/libro-jupyter';
import { LibroTOCModule } from '@difizen/libro-toc';
import { Container, ManaAppPreset, ManaComponents } from '@difizen/mana-app';
import React, { useState } from 'react';

import { Autowired, Injector } from '@opensumi/di';
import {
  ClientAppContextContribution,
  ClientAppContribution,
  CommandContribution,
  type CommandRegistry,
  Domain,
  IClientApp,
  Schemes,
  URI,
} from '@opensumi/ide-core-browser';
import {
  BrowserEditorContribution,
  EditorComponentRegistry,
  IResource,
  ResourceService,
  WorkbenchEditorService,
} from '@opensumi/ide-editor/lib/browser';
import { IconService } from '@opensumi/ide-theme/lib/browser';
import { IThemeService, IconType } from '@opensumi/ide-theme/lib/common';

import { initKernelPanelColorToken } from './kernel-panel';
import { LibroOpensumiModule } from './libro';
import { initLibroColorToken } from './libro.color.tokens';
import { LIBRO_COMPONENTS_ID, LIBRO_COMPONENTS_SCHEME_ID } from './libro.protocol';
import { OpensumiLibroView } from './libro.view';
import { ManaContainer, initLibroOpensumi, manaContainer } from './mana/index';
import { initTocPanelColorToken } from './toc';

const LIBRO_COMPONENTS_VIEW_COMMAND = {
  id: 'opensumi-libro',
};

const LayoutWrapper: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  return (
    <ManaComponents.Application
      context={{ container: manaContainer }}
      modules={[ManaAppPreset, LibroJupyterNoEditorModule, LibroTOCModule, LibroOpensumiModule]}
      renderChildren
      onReady={() => setIsReady(true)}
    >
      {isReady ? children : 'loading'}
    </ManaComponents.Application>
  );
};

@Domain(ClientAppContribution, BrowserEditorContribution, ClientAppContextContribution, CommandContribution)
export class LibroContribution
  implements ClientAppContribution, BrowserEditorContribution, ClientAppContextContribution, CommandContribution
{
  @Autowired(ManaContainer)
  private readonly manaContainer: Container;

  @Autowired(IconService)
  protected readonly iconService: IconService;

  @Autowired(WorkbenchEditorService)
  protected readonly editorService: WorkbenchEditorService;

  @Autowired(IThemeService)
  protected readonly themeService: IThemeService;

  initialize(app: IClientApp) {
    initLibroOpensumi(app.injector, manaContainer);
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
    // return Layout;
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
        results.push({
          type: 'component',
          componentId: LIBRO_COMPONENTS_ID,
        });
      }
    });
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
    // const manaThemeService = this.manaContainer.get(ThemeService);
    // const curTheme = await this.themeService.getCurrentTheme();
    // manaThemeService.setCurrentTheme(curTheme.type);
    // this.themeService.onThemeChange((theme) => {
    //   manaThemeService.setCurrentTheme(theme.type);
    // });
  }
}
