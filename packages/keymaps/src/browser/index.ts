import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';
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
