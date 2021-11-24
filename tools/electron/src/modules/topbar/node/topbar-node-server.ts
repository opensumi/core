import { Injectable } from '@opensumi/common-di';
import { ITopbarNodeServer } from '../common';

@Injectable()
export class TopbarNodeServer implements ITopbarNodeServer {
    topbarHello() {
        console.log('you click topbar');
    }
}
