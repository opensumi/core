import { IRPCProtocol } from '@ali/ide-connection';
import { Disposable, Position, Range, Location } from '../../common/ext-types';
import * as extHostTypeConverter from '../../common/coverter';
import { MainThreadAPIIdentifier, IMainThreadStatusBar, IExtHostStatusBar, Handler, ArgumentProcessor } from '../../common';
import { cloneAndChange } from '@ali/ide-core-common/lib/utils/objects';
import { validateConstraint } from '@ali/ide-core-common/lib/utils/types';
import { ILogger, getLogger, revive } from '@ali/ide-core-common';

export class ExtHostStatusBar implements IExtHostStatusBar {
  protected readonly proxy: IMainThreadStatusBar;
  protected readonly rpcProtocol: IRPCProtocol;
  protected readonly logger: ILogger = getLogger();
  protected readonly argumentProcessors: ArgumentProcessor[] = [];
  constructor(rpcProtocol: IRPCProtocol) {
    this.rpcProtocol = rpcProtocol;
    this.proxy = this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadStatusBar);
  }

  setStatusBarMessage(text: string, arg?: number | Thenable<any>): Disposable {

    // step3
    this.proxy.$setStatusBarMessage(text);
    let handle: NodeJS.Timer | undefined;

    if (typeof arg === 'number') {
        handle = setTimeout(() => this.proxy.$dispose(), arg);
    } else if (typeof arg !== 'undefined') {
        arg.then(() => this.proxy.$dispose(), () => this.proxy.$dispose());
    }

    return Disposable.create(() => {
        this.proxy.$dispose();
        if (handle) {
            clearTimeout(handle);
        }
    });
  }

}
