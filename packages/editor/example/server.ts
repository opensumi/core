import { startServer } from '@ali/ide-dev-tool/src/server';
import { EditorModule } from '../src/node';

startServer({
  modules: [
    EditorModule,
  ],
});
