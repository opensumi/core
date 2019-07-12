import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { OpenedEditorTreeDataProvider } from './opened-editor';

@Injectable()
export class OpenedEditorModule extends BrowserModule {
  providers: Provider[] = [
    OpenedEditorTreeDataProvider,
  ];
}
