import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { OutlineContribution } from './outline.contribution';
import { OutlineDecorationService } from './services/outline-decoration.service';
import { OutlineEventService } from './services/outline-event.service';
import { OutlineTreeService } from './services/outline-tree.service';
import { OutlineModelService } from './services/outline-model.service';

@Injectable()
export class OutlineModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: OutlineDecorationService,
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
