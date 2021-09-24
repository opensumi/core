import { Injectable } from '@ali/common-di';
import { BrowserModule } from '../browser-module';
import { ClientCommonContribution } from './common.contribution';
import { OpenerContribution } from '../opener';
import { DefaultOpenerContribution, OpenerContributionClient } from '../opener/opener.contribution';
import { CommonServerPath, CryptrServicePath, KeytarServicePath } from '@ali/ide-core-common';
import { AuthenticationContribution } from '../authentication/authentication.contribution';

@Injectable()
export class ClientCommonModule extends BrowserModule {
  contributionProvider = [ OpenerContribution ];
  providers = [
    ClientCommonContribution,
    DefaultOpenerContribution,
    OpenerContributionClient,
    AuthenticationContribution,
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
