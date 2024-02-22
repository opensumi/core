import { Autowired, Injectable } from '@opensumi/di';
import {
  COMMON_COMMANDS,
  Domain,
  MaybePromise,
  PreferenceConfiguration,
  PreferenceContribution,
  PreferenceSchema,
  URI,
  getIcon,
  localize,
} from '@opensumi/ide-core-browser';
import { IMenuRegistry, MenuContribution } from '@opensumi/ide-core-browser/lib/menu/next/base';
import { MenuId } from '@opensumi/ide-core-browser/lib/menu/next/menu-id';
import {
  BrowserEditorContribution,
  EditorComponentRegistry,
  EditorOpenType,
  IResource,
  IResourceProvider,
  ResourceService,
} from '@opensumi/ide-editor/lib/browser';

import { LAUNCH_VIEW_COMPONENT_ID, LAUNCH_VIEW_SCHEME } from '../../common/constants';

import { launchPreferencesSchema } from './launch-preferences';
import { LaunchViewContainer } from './launch.view';

@Injectable()
export class LaunchResourceProvider implements IResourceProvider {
  readonly scheme: string = LAUNCH_VIEW_SCHEME;

  provideResource(uri: URI): MaybePromise<IResource<any>> {
    return {
      supportsRevive: true,
      name: localize('menu-bar.title.debug'),
      icon: getIcon('debug'),
      uri,
    };
  }

  provideResourceSubname(): string | null {
    return null;
  }

  async shouldCloseResource(): Promise<boolean> {
    return true;
  }
}

@Domain(PreferenceContribution, PreferenceConfiguration, BrowserEditorContribution, MenuContribution)
export class LaunchPreferencesContribution
  implements PreferenceContribution, PreferenceConfiguration, BrowserEditorContribution, MenuContribution
{
  @Autowired(LaunchResourceProvider)
  private readonly prefResourceProvider: LaunchResourceProvider;

  schema: PreferenceSchema = launchPreferencesSchema;
  name = 'launch';

  registerResource(resourceService: ResourceService): void {
    resourceService.registerResourceProvider(this.prefResourceProvider);
  }

  registerEditorComponent(editorComponentRegistry: EditorComponentRegistry): void {
    editorComponentRegistry.registerEditorComponent({
      component: LaunchViewContainer,
      uid: LAUNCH_VIEW_COMPONENT_ID,
      scheme: LAUNCH_VIEW_SCHEME,
    });

    editorComponentRegistry.registerEditorComponentResolver(LAUNCH_VIEW_SCHEME, (_, __, resolve) => {
      resolve([
        {
          type: EditorOpenType.component,
          componentId: LAUNCH_VIEW_COMPONENT_ID,
        },
      ]);
    });
  }

  registerMenus(menus: IMenuRegistry) {
    menus.registerMenuItem(MenuId.EditorTitle, {
      command: COMMON_COMMANDS.OPEN_LAUNCH_CONFIGURATION.id,
      iconClass: getIcon('open'),
      group: 'navigation',
      when: `resourceScheme == ${LAUNCH_VIEW_SCHEME}`,
    });
  }
}
