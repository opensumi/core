import { Injectable } from '@opensumi/di';
import { CommonServerPath, CryptrServicePath, KeytarServicePath } from '@opensumi/ide-core-common';

import { AuthenticationContribution } from '../authentication/authentication.contribution';
import { BrowserModule } from '../browser-module';
import { HashCalculateContribution } from '../hash-calculate/hash-calculate.contribution';
import { OpenerContribution } from '../opener';
import { DefaultOpenerContribution, OpenerContributionClient } from '../opener/opener.contribution';

import { ClientCommonContribution } from './common.contribution';

@Injectable()
export class ClientCommonModule extends BrowserModule {
  contributionProvider = [OpenerContribution];
  providers = [
    ClientCommonContribution,
    DefaultOpenerContribution,
    OpenerContributionClient,
    AuthenticationContribution,
    HashCalculateContribution,
  ];
  backServices = [
    {
      servicePath: CommonServerPath,
    },
    {
      servicePath: KeytarServicePath,
    },
    {
      servicePath: CryptrServicePath,
    },
  ];
}
