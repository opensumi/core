import { Injectable } from '@ali/common-di';
import { BrowserModule } from '..';
import { ClientCommonContribution } from './common.contribution';
import { OpenerContribution } from '../opener';
import { DefaultOpnerContribution, OpenerContributionClient } from '../opener/opener.contribution';
import { CommonServerPath } from '@ali/ide-core-common';

@Injectable()
export class ClientCommonModule extends BrowserModule {
  contributionProvider = [ OpenerContribution ];
  providers = [
    ClientCommonContribution,
    DefaultOpnerContribution,
    OpenerContributionClient,
  ];
  backServices = [
    {
      servicePath: CommonServerPath,
    },
  ];
}
