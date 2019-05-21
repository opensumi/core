import { Provider, Injectable, Autowired } from '@ali/common-di';
import { SlotMap } from '@ali/ide-core-browser';
import { SlotLocation, BrowserModule } from '@ali/ide-core-browser';
import { MainLayout } from './main-layout.view';
import { MainLayoutContribution } from './main-layout.contribution';

@Injectable()
export class MainLayoutModule extends BrowserModule {
  providers: Provider[] = [];

  slotMap: SlotMap = new Map([
    [SlotLocation.main, MainLayout],
  ]);

  @Autowired()
  private mainLayoutContribution: MainLayoutContribution;

  active() {
    const app = this.app;
    app.commandRegistry.onStart([ this.mainLayoutContribution ]);
  }
}
