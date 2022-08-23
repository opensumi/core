import { Injectable, Autowired, INJECTOR_TOKEN, Injector, Optional } from '@opensumi/di';
import {
  IJSONSchemaRegistry,
  ILogger,
  WithEventBus,
  IEventBus,
  EXTENSION_JSON_URI,
  OpensumiExtensionPackageSchema,
} from '@opensumi/ide-core-browser';

import { IExtensionMetaData, CONTRIBUTE_NAME_KEY } from '../../../common';
import { ExtensionWillContributeEvent } from '../../types';

import { BrowserMainContributionPoint } from './browser-main';
import { BrowserViewContributionPoint, KtViewsSchema } from './browser-views';
import { MenuExtendContributionPoint } from './menu-extend';
import { MenubarsContributionPoint } from './menubar';
import { NodeMainContributionPoint } from './node-main';
import { SubmenusContributionPoint } from './submenu';
import { ToolbarContributionPoint } from './toolbar';
import { ViewsProxiesContributionPoint } from './views-proxies';
import { WorkerMainContributionPoint } from './worker-main';

const CONTRIBUTES_SYMBOL = Symbol();

export interface KaitianContributesSchema {
  views: KtViewsSchema;
}

@Injectable({ multiple: true })
export class SumiContributesRunner extends WithEventBus {
  static ContributePoints = [
    BrowserViewContributionPoint,
    BrowserMainContributionPoint,
    NodeMainContributionPoint,
    WorkerMainContributionPoint,
    ViewsProxiesContributionPoint,
    MenubarsContributionPoint,
    SubmenusContributionPoint,
    ToolbarContributionPoint,
    MenuExtendContributionPoint,
  ];

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(IJSONSchemaRegistry)
  schemaRegistry: IJSONSchemaRegistry;

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

    for (const contributeCls of SumiContributesRunner.ContributePoints) {
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

          if (contributeCls.schema) {
            OpensumiExtensionPackageSchema.properties.kaitianContributes.properties[contributeName] =
              contributeCls.schema;
          }

          this.addDispose(contributePoint);
          await contributePoint.contribute();
        } catch (e) {
          this.logger.error(e);
        }
      }
    }
    this.schemaRegistry.registerSchema(EXTENSION_JSON_URI, OpensumiExtensionPackageSchema, ['package.json']);
  }
}
