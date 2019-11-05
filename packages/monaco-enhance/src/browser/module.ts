import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule, Domain, ClientAppContribution } from '@ali/ide-core-browser';
import { ZoneWidget } from './zone-widget';

@Domain(ClientAppContribution)
class MonacoEnhanceContribution implements ClientAppContribution {
  onDidStart() {
    /*
    monaco.editor.onDidCreateEditor((editor) => {
      const widget = new ZoneWidget(editor);
      setTimeout(() => {
        widget.show({
          startLineNumber: 5,
          endLineNumber: 5,
          startColumn: 1,
          endColumn: 1,
        }, 9);
      }, 5000);
    });
    */
  }
}

@Injectable()
export class MonacoEnhanceModule extends BrowserModule {
  providers: Provider[] = [
    MonacoEnhanceContribution,
  ];
}
