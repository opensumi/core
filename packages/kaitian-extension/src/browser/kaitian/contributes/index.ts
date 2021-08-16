import { Injectable, Autowired, INJECTOR_TOKEN, Injector, Optional } from '@ali/common-di';
import { ISchemaRegistry, localize, ILogger, WithEventBus, IEventBus } from '@ali/ide-core-browser';
import { IExtensionMetaData, CONTRIBUTE_NAME_KEY } from '../../../common';
import { ExtensionWillContributeEvent } from '../../types';

import { KtViewContributionPoint, KtViewsSchema } from './browser-views';
import { KtMenubarsContributionPoint } from './menubar';
import { KtSubmenusContributionPoint } from './submenu';
import { KtToolbarContributionPoint } from './toolbar';

const CONTRIBUTES_SYMBOL = Symbol();

export interface KaitianContributesSchema {
  views: KtViewsSchema;
}

const EXTENSION_JSON_URI = 'vscode://schemas/vscode-extensions';

const schema = {
  properties: {
    kaitianContributes: {
      description: localize('vscode.extension.kaitianContributes', 'All contributions of the KAITIAN extension represented by this package.'),
      type: 'object',
      properties: {} as { [key: string]: any },
      default: {},
    },
  },
};

@Injectable({ multiple: true })
export class KaitianContributesRunner extends WithEventBus {
  static ContributePoints = [
    KtViewContributionPoint,
    KtMenubarsContributionPoint,
    KtSubmenusContributionPoint,
    KtToolbarContributionPoint,
  ];

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(ISchemaRegistry)
  schemaRegistry: ISchemaRegistry;

  @Autowired(ILogger)
  private logger: ILogger;

  @Autowired(IEventBus)
  protected eventBus: IEventBus;

  constructor(@Optional(CONTRIBUTES_SYMBOL) private extension: IExtensionMetaData) {
    super();
  }

  public async run() {
    const contributes: KaitianContributesSchema = this.extension.packageJSON.kaitianContributes;
    if (!contributes) {
      return;
    }

    const skipContribute = await this.eventBus.fireAndAwait(new ExtensionWillContributeEvent(this.extension));

    if (skipContribute.length > 0 && skipContribute[0]?.result) {
      return;
    }

    for (const contributeCls of KaitianContributesRunner.ContributePoints) {
      const contributeName = Reflect.getMetadata(CONTRIBUTE_NAME_KEY, contributeCls);
      if (contributes[contributeName] !== undefined) {
        try {
          const contributePoint = this.injector.get(contributeCls, [
            contributes[contributeName],
            contributes,
            this.extension,
            this.extension.packageNlsJSON,
            this.extension.defaultPkgNlsJSON,
          ]);

          if (contributePoint.schema) {
            schema.properties.kaitianContributes.properties[contributeName] = contributePoint.schema;
          }

          this.addDispose(contributePoint);
          await contributePoint.contribute();
        } catch (e) {
          this.logger.error(e);
        }
      }
    }
    this.schemaRegistry.registerSchema(EXTENSION_JSON_URI, schema, ['package.json']);
  }
}
