import { Provider, Injectable } from '@ide-framework/common-di';
import { BrowserModule } from '@ide-framework/ide-core-browser';
import { KeymapsContribution } from './keymaps.contribution';
import { IKeymapService } from '../common';
import { KeymapService } from './keymaps.service';

@Injectable()
export class KeymapsModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: IKeymapService,
      useClass: KeymapService,
    },
    KeymapsContribution,
  ];

}
