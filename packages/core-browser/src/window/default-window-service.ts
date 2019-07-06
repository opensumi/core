import { Injectable, Autowired } from '@ali/common-di';
import { CorePreferences } from '../core-preferences';
import { ContributionProvider } from '@ali/ide-core-common';
import { ClientAppContribution, ClientApp } from '../bootstrap/app';
import { WindowService } from './window-service';

@Injectable()
export class WindowServiceImpl implements WindowService, ClientAppContribution {

    protected frontendApplication: ClientApp;

    @Autowired(CorePreferences)
    protected readonly corePreferences: CorePreferences;

    // @Autowired(ClientAppContribution)
    // protected readonly contributions: ContributionProvider<ClientAppContribution>;

    onStart(app: ClientApp): void {
        this.frontendApplication = app;
        window.addEventListener('beforeunload', (event) => {
            if (!this.canUnload()) {
                event.returnValue = '';
                event.preventDefault();
                return '';
            }
        });
    }

    openNewWindow(url: string): Window | undefined {
        const newWindow = window.open(url);
        if (newWindow === null) {
            throw new Error('Cannot open a new window for URL: ' + url);
        }
        return newWindow;
    }

    canUnload(): boolean {
        const confirmExit = this.corePreferences['application.confirmExit'];
        if (confirmExit === 'never') {
            return true;
        }
        // for (const contribution of this.contributions.getContributions()) {
        //     if (contribution.onWillStop) {
        //         if (!!contribution.onWillStop(this.frontendApplication)) {
        //             return false;
        //         }
        //     }
        // }
        return confirmExit !== 'always';
    }

}
