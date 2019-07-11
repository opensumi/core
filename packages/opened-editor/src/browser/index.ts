import { Provider, Autowired, Injectable } from '@ali/common-di';
import { BrowserModule, Domain, ClientAppContribution } from '@ali/ide-core-browser';
import { OpenedEditorTreeDataProvider } from './opened-editor';

@Injectable()
export class OpenedEditorModule extends BrowserModule {
  providers: Provider[] = [
    OpenedEditorTreeDataProvider,
    EditorClientAppContribution,
  ];
}

@Domain(ClientAppContribution)
export class EditorClientAppContribution implements ClientAppContribution {

  @Autowired()
  private dataProvider: OpenedEditorTreeDataProvider;

  onStart() {
    this.dataProvider.onDidChangeTreeData(() => {
      console.log(this.dataProvider.getChildren());
    });
  }
}
