import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { SCMContribution } from './scm-contribution';
import { SCMService } from '../common/scm.service';

@Injectable()
export class SCMModule extends BrowserModule {
  providers: Provider[] = [
    SCMContribution,
    {
      token: SCMService,
      useClass: SCMService,
    },
  ];
}
