import { Provider, Injectable } from '@ide-framework/common-di';
import { BrowserModule } from '@ide-framework/ide-core-browser';

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
