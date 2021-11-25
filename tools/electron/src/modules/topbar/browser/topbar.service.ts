import { Injectable, Autowired } from '@opensumi/common-di';
import { Disposable } from '@opensumi/ide-core-common';
import { ITopbarNodeServer, ITopbarService, TopbarNodeServerPath } from '../common';

@Injectable()
export class TopbarService extends Disposable implements ITopbarService {

    @Autowired(TopbarNodeServerPath)
    topbarNodeServer: ITopbarNodeServer;

    sayHelloFromNode() {
        console.log('browser hello!');
        this.topbarNodeServer.topbarHello();
    }

}
