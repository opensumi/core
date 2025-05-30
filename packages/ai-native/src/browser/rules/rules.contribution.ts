import { Autowired } from '@opensumi/di';
import { getIcon } from '@opensumi/ide-components';
import { ClientAppContribution } from '@opensumi/ide-core-browser';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import {
  CommandContribution,
  CommandRegistry,
  Domain,
  RulesServiceToken,
  URI,
  localize,
} from '@opensumi/ide-core-common';
import {
  BrowserEditorContribution,
  EditorComponentRegistry,
  EditorComponentRenderMode,
  IResource,
  ResourceService,
  WorkbenchEditorService,
} from '@opensumi/ide-editor/lib/browser/types';
import { IconService } from '@opensumi/ide-theme/lib/browser';
import { IWorkspaceService } from '@opensumi/ide-workspace/lib/common';

import { RulesService } from './rules.service';
import { RulesView } from './rules.view';

export namespace RulesCommands {
  export const OPEN_RULES_FILE = {
    id: 'rules.openRulesConfig',
    label: 'Open Rules Configuration',
  };
}

const COMPONENTS_ID = 'opensumi-rules-viewer';
export const RULES_COMPONENTS_SCHEME_ID = 'rules';

export type IRulesResource = IResource<{ configType: string }>;

@Domain(BrowserEditorContribution, CommandContribution, ClientAppContribution)
export class RulesContribution implements BrowserEditorContribution, CommandContribution, ClientAppContribution {
  @Autowired(IWorkspaceService)
  protected readonly workspaceService: IWorkspaceService;

  @Autowired(IconService)
  protected readonly iconService: IconService;

  @Autowired(WorkbenchEditorService)
  protected readonly editorService: WorkbenchEditorService;

  @Autowired()
  labelService: LabelService;

  @Autowired(RulesServiceToken)
  protected readonly rulesService: RulesService;

  onStart() {
    this.rulesService.initProjectRules();
  }

  registerEditorComponent(registry: EditorComponentRegistry) {
    registry.registerEditorComponent({
      uid: COMPONENTS_ID,
      scheme: RULES_COMPONENTS_SCHEME_ID,
      component: RulesView,
      renderMode: EditorComponentRenderMode.ONE_PER_WORKBENCH,
    });

    registry.registerEditorComponentResolver(RULES_COMPONENTS_SCHEME_ID, (resource, results) => {
      results.push({
        type: 'component',
        componentId: COMPONENTS_ID,
      });
    });
  }

  registerResource(service: ResourceService) {
    service.registerResourceProvider({
      scheme: RULES_COMPONENTS_SCHEME_ID,
      provideResource: async (uri: URI): Promise<IRulesResource> => {
        const { configType } = uri.getParsedQuery();

        return {
          uri,
          name: localize('ai.native.rules.title'),
          icon: getIcon('rules'),
          metadata: {
            configType,
          },
        };
      },
    });
  }

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand(RulesCommands.OPEN_RULES_FILE, {
      execute: () => {
        const uri = new URI().withScheme(RULES_COMPONENTS_SCHEME_ID);
        this.editorService.open(uri, {
          preview: false,
          focus: true,
        });
      },
    });
  }
}
