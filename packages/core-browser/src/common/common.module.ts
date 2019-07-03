import { Injectable } from '@ali/common-di';
import { BrowserModule } from '..';
import { ClientCommonContribution } from './common.contribution';

@Injectable()
export class ClientCommonModule extends BrowserModule {
  providers = [
    ClientCommonContribution,
  ];
}
