import { Injectable, Provider } from '@ali/common-di';
import { SlotMap, BrowserModule } from '@ali/ide-core-browser';
import { FileSystemEditorContribution } from './file-scheme.contribution';

@Injectable()
export class FileSchemeModule extends BrowserModule {
  providers: Provider[] = [
    FileSystemEditorContribution,
  ];
  slotMap: SlotMap = new Map();
}
