import { Injectable, Provider } from '@ali/common-di';
import { SlotMap, BrowserModule } from '@ali/ide-core-browser';

@Injectable()
export class FileSchemeModule extends BrowserModule {
  providers: Provider[] = [];
  slotMap: SlotMap = new Map();
}
