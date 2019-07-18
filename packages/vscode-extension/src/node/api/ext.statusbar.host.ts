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

  setStatusBarMessage(text: string): Disposable {

    // step3
    return this.proxy.$setStatusBarMessage(text);

  }
}
