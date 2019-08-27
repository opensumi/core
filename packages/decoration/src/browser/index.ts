import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';

import { IDecorationsService } from '../common/decorations';
import { FileDecorationsService } from './decorationsService';

@Injectable()
export class DecorationModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: IDecorationsService,
      useClass: FileDecorationsService,
    },
  ];
}
