import { Injectable } from '@ali/common-di';
import { ITopbarNodeServer } from '../common';

@Injectable()
export class TopbarNodeServer implements ITopbarNodeServer {
    topbarHello() {
        console.log('you click topbar');
    }
}
