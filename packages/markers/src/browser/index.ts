import { Injectable, Provider } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { IMarkerService } from '../common';
import { MarkersContribution } from './markers-contribution';
import { MarkerService } from './markers-service';

@Injectable()
export class MarkersModule extends BrowserModule {
  providers: Provider[] = [
    MarkersContribution,
    {
      token: IMarkerService,
      useClass: MarkerService,
    },
  ];
}
