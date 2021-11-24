import { Provider, Injectable } from '@opensumi/common-di';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { OutlineContribution } from './outline.contribution';
import { OutlineDecorationService } from './services/outline-decoration.service';
import { OutlineEventService } from './services/outline-event.service';
import { OutlineTreeService } from './services/outline-tree.service';
import { OutlineModelService } from './services/outline-model.service';
import { IOutlineDecorationService } from '../common';

@Injectable()
export class OutlineModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: IOutlineDecorationService,
      useClass: OutlineDecorationService,
    },
    {
      token: OutlineEventService,
      useClass: OutlineEventService,
    },
    {
      token: OutlineTreeService,
      useClass: OutlineTreeService,
    },
    {
      token: OutlineModelService,
      useClass: OutlineModelService,
    },
    OutlineContribution,
  ];
}
