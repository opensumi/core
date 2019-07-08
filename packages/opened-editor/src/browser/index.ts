import { Provider, Autowired } from '@ali/common-di';
import { BrowserModule, EffectDomain, Domain, ClientAppContribution } from '@ali/ide-core-browser';
import { OpenedEditorTreeDataProvider } from './opened-editor.service';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class OpenedEditorModule extends BrowserModule {
  providers: Provider[] = [
    OpenedEditorTreeDataProvider,
  ];
}
