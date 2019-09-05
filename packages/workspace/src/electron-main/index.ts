import { ElectronMainContribution, ElectronMainApiRegistry, IElectronMainApiProvider, ElectronMainModule } from '@ali/ide-core-electron-main';
import { Autowired, INJECTOR_TOKEN, Injector, Injectable} from '@ali/common-di';
import { WorkspaceBackendServer } from '../node/workspace-backend-service';
import { Domain } from '@ali/ide-core-common';

@Domain(ElectronMainContribution)
export class ElectronMainWorkspaceContribution implements ElectronMainContribution {

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  registerMainApi(registry: ElectronMainApiRegistry) {
    registry.registerMainApi('workspace',  this.injector.get(ElectronMainWorkspaceService));
  }

}

@Injectable()
export class ElectronMainWorkspaceService extends WorkspaceBackendServer implements IElectronMainApiProvider<void> {

  eventEmitter: undefined;

}

@Injectable()
export class ElectronMainWorkspaceModule extends ElectronMainModule {

  providers = [
    ElectronMainWorkspaceContribution,
  ];

}
