import { Injectable } from '@opensumi/di';

import { ExtensionContributesService, VSCodeContributePoint } from '../../../common';

import { BrowserMainContributionPoint } from './browser-main';
import { BrowserViewContributionPoint } from './browser-views';
import { MenuExtendContributionPoint } from './menu-extend';
import { MenubarsContributionPoint } from './menubar';
import { NodeMainContributionPoint } from './node-main';
import { SubmenusContributionPoint } from './submenu';
import { ToolbarContributionPoint } from './toolbar';
import { ViewsProxiesContributionPoint } from './views-proxies';
import { WorkerMainContributionPoint } from './worker-main';

export const SumiContributionsServiceToken = Symbol('SumiContributionsService');

@Injectable()
export class SumiContributionsService extends ExtensionContributesService {
  ContributionPoints = [
    BrowserViewContributionPoint,
    BrowserMainContributionPoint,
    NodeMainContributionPoint,
    WorkerMainContributionPoint,
    ViewsProxiesContributionPoint,
    MenubarsContributionPoint,
    SubmenusContributionPoint,
    ToolbarContributionPoint,
    MenuExtendContributionPoint,
  ] as typeof VSCodeContributePoint[];
}
