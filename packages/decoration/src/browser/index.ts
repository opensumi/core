import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

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
