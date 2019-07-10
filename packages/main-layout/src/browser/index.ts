import { Provider, Injectable } from '@ali/common-di';
import { MainLayout } from './main-layout.view';
import { MainLayoutContribution } from './main-layout.contribution';
import { BrowserModule } from '@ali/ide-core-browser';

@Injectable()
export class MainLayoutModule extends BrowserModule {
  providers: Provider[] = [
    MainLayoutContribution,
  ];
  component: React.FunctionComponent = MainLayout;
}
