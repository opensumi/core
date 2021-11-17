import { Injectable } from '@ide-framework/common-di';
import { ITopbarNodeServer } from '../common';

@Injectable()
export class TopbarNodeServer implements ITopbarNodeServer {
    topbarHello() {
        console.log('you click topbar');
    }
}
