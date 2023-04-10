import { Autowired, Injectable } from '@opensumi/di';
import {
  PreferenceContribution,
  PreferenceSchema,
  Domain,
  PreferenceConfiguration,
  URI,
  MaybePromise,
  localize,
  getIcon,
} from '@opensumi/ide-core-browser';
import {
  BrowserEditorContribution,
  EditorComponentRegistry,
  EditorOpenType,
  IResource,
  IResourceProvider,
  ResourceService,
} from '@opensumi/ide-editor/lib/browser';

import { launchPreferencesSchema } from './launch-preferences';
import { LaunchViewContainer } from './launch.view';

const LAUNCH_VIEW_SCHEME = 'launch_view_scheme';
const LAUNCH_VIEW_COMPONENT_ID = 'launch-view';

@Injectable()
export class LaunchResourceProvider implements IResourceProvider {
  readonly scheme: string = LAUNCH_VIEW_SCHEME;

  provideResource(uri: URI): MaybePromise<IResource<any>> {
    // 获取文件类型 getFileType: (path: string) => string
    return {
      supportsRevive: true,
      name: localize('menu-bar.title.debug'),
      icon: getIcon('debug'),
      uri,
    };
  }

  provideResourceSubname(resource: IResource, groupResources: IResource[]): string | null {
    return null;
  }

  async shouldCloseResource(resource: IResource, openedResources: IResource[][]): Promise<boolean> {
    return true;
  }
}

@Domain(PreferenceContribution, PreferenceConfiguration, BrowserEditorContribution)
export class LaunchPreferencesContribution
  implements PreferenceContribution, PreferenceConfiguration, BrowserEditorContribution
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
}
