import { startElectron } from '@ali/ide-dev-tool/src/electron';
// import { FileServiceModule } from '@ali/ide-file-service';
// import { DocModelModule } from '@ali/ide-doc-model/lib/node';
import { Injector } from '@ali/common-di';

const injector = new Injector();
startElectron([]);
