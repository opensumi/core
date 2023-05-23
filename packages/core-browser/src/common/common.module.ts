import { Injectable, Autowired, Provider } from '@opensumi/di';
import { CommonServerPath, CryptoServicePath, KeytarServicePath } from '@opensumi/ide-core-common';

import { AuthenticationContribution } from '../authentication/authentication.contribution';
import { BrowserModule } from '../browser-module';
import { HashCalculateContribution } from '../hash-calculate/hash-calculate.contribution';
import { OpenerContribution } from '../opener';
import { ElectronOpenerContributionClient } from '../opener/opener-electron.contribution';
import { DefaultOpenerContribution, OpenerContributionClient } from '../opener/opener.contribution';

import { ClientElectronCommonContribution } from './common-electron.contribution';
import { ClientWebCommonContribution } from './common-web.contribution';
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
  ] as Provider[];

  electronProviders = [ClientElectronCommonContribution, ElectronOpenerContributionClient];
  webProviders = [ClientWebCommonContribution];

  backServices = [
    {
      servicePath: CommonServerPath,
    },
    {
      servicePath: KeytarServicePath,
    },
    {
      servicePath: CryptoServicePath,
    },
  ];
}
