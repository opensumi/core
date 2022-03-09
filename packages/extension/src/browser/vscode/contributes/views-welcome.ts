import { Injectable, Autowired } from '@opensumi/di';
import { DisposableCollection, localize } from '@opensumi/ide-core-browser';
import { DEBUG_WELCOME_ID } from '@opensumi/ide-debug';
import { IMainLayoutService, IViewContentDescriptor, IViewsRegistry } from '@opensumi/ide-main-layout';
import { ContextKeyExpr } from '@opensumi/monaco-editor-core/esm/vs/platform/contextkey/common/contextkey';

import { VSCodeContributePoint, Contributes } from '../../../common';

export enum ViewsWelcomeExtensionPointFields {
  view = 'view',
  contents = 'contents',
  when = 'when',
  group = 'group',
  enablement = 'enablement',
}

export interface ViewWelcome {
  readonly [ViewsWelcomeExtensionPointFields.view]: string;
  readonly [ViewsWelcomeExtensionPointFields.contents]: string;
  readonly [ViewsWelcomeExtensionPointFields.when]: string;
  readonly [ViewsWelcomeExtensionPointFields.group]: string;
  readonly [ViewsWelcomeExtensionPointFields.enablement]: string;
}

export type ViewsWelcomeSchema = ViewWelcome[];

export const ViewIdentifierMap: { [key: string]: string } = {
  explorer: 'file-explorer-next',
  debug: DEBUG_WELCOME_ID,
  scm: 'scm_view',
};

@Injectable()
@Contributes('viewsWelcome')
export class ViewsWelcomeContributionPoint extends VSCodeContributePoint<ViewsWelcomeSchema> {
  @Autowired(IMainLayoutService)
  mainlayoutService: IMainLayoutService;

  @Autowired(IViewsRegistry)
  viewsRegistry: IViewsRegistry;

  schema = {
    type: 'array',
    description: localize(
      'contributes.viewsWelcome',
      'Contributed views welcome content. Welcome content will be rendered in tree based views whenever they have no meaningful content to display, ie. the File Explorer when no folder is open. Such content is useful as in-product documentation to drive users to use certain features before they are available. A good example would be a `Clone Repository` button in the File Explorer welcome view.',
    ),
    items: {
      type: 'object',
      description: localize('contributes.viewsWelcome.view', 'Contributed welcome content for a specific view.'),
      required: [ViewsWelcomeExtensionPointFields.view, ViewsWelcomeExtensionPointFields.contents],
      properties: {
        [ViewsWelcomeExtensionPointFields.view]: {
          anyOf: [
            {
              type: 'string',
              description: localize(
                'contributes.viewsWelcome.view.view',
                'Target view identifier for this welcome content. Only tree based views are supported.',
              ),
            },
            {
              type: 'string',
              description: localize(
                'contributes.viewsWelcome.view.view',
                'Target view identifier for this welcome content. Only tree based views are supported.',
              ),
              enum: Object.keys(ViewIdentifierMap),
            },
          ],
        },
        [ViewsWelcomeExtensionPointFields.contents]: {
          type: 'string',
          description: localize(
            'contributes.viewsWelcome.view.contents',
            'Welcome content to be displayed. The format of the contents is a subset of Markdown, with support for links only.',
          ),
        },
        [ViewsWelcomeExtensionPointFields.when]: {
          type: 'string',
          description: localize(
            'contributes.viewsWelcome.view.when',
            'Condition when the welcome content should be displayed.',
          ),
        },
        [ViewsWelcomeExtensionPointFields.group]: {
          type: 'string',
          description: localize('contributes.viewsWelcome.view.group', 'Group to which this welcome content belongs.'),
        },
        [ViewsWelcomeExtensionPointFields.enablement]: {
          type: 'string',
          description: localize(
            'contributes.viewsWelcome.view.enablement',
            'Condition when the welcome content buttons and command links should be enabled.',
          ),
        },
      },
    },
  };

  private disposableCollection: DisposableCollection = new DisposableCollection();

  contribute() {
    const welcomesByViewId = new Map<string, Map<ViewWelcome, IViewContentDescriptor>>();
    for (const welcome of this.json) {
      const { group, order } = parseGroupAndOrder(welcome);
      const precondition = ContextKeyExpr.deserialize(welcome.enablement);

      const id = ViewIdentifierMap[welcome.view] ?? welcome.view;
      let viewContentMap = welcomesByViewId.get(id);
      if (!viewContentMap) {
        viewContentMap = new Map();
        welcomesByViewId.set(id, viewContentMap);
      }

      viewContentMap.set(welcome, {
        content: this.getLocalizeFromNlsJSON(welcome.contents),
        when: ContextKeyExpr.deserialize(welcome.when),
        precondition,
        group,
        order,
      });
    }
    for (const [id, viewContentMap] of welcomesByViewId) {
      const disposables = this.viewsRegistry.registerViewWelcomeContent2(id, viewContentMap);

      for (const [, disposable] of disposables) {
        this.disposableCollection.push(disposable);
      }
    }
  }

  dispose() {
    this.disposableCollection.dispose();
  }
}

function parseGroupAndOrder(welcome: ViewWelcome): { group: string | undefined; order: number | undefined } {
  let group: string | undefined;
  let order: number | undefined;
  if (welcome.group) {
    const idx = welcome.group.lastIndexOf('@');
    if (idx > 0) {
      group = welcome.group.substr(0, idx);
      order = Number(welcome.group.substr(idx + 1)) || undefined;
    } else {
      group = welcome.group;
    }
  }
  return { group, order };
}
