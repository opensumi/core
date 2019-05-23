import { startServer } from '@ali/ide-dev-tool/src/server';
import { FileServiceModule } from '@ali/ide-file-service';
import { DocModelModule } from '@ali/ide-doc-model/lib/node';
import { Injector } from '@ali/common-di';

const injector = new Injector();
startServer([
  injector.get(FileServiceModule),
  injector.get(DocModelModule),
]);

// startServer([]);
