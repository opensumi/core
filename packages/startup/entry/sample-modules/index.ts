import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { SelectMenuContribution } from './select-menu.contribution';
import { EditorTitleMenuContribution } from './editor-title-menu.contribution';

@Injectable()
export class SampleModule extends BrowserModule {
  providers: Provider[] = [
    SelectMenuContribution,
    EditorTitleMenuContribution,
  ];
}
