import { VSCodeExtensionService } from '../../src/common/vscode';
import { mockExtensionProps, mockExtensionProps2 } from '../extensions';

export class MainThreadExtensionService implements VSCodeExtensionService {
  $getExtensions() {
    return Promise.resolve([mockExtensionProps, mockExtensionProps2]);
  }

  $activateExtension(extensionPath: string) {
    return Promise.resolve();
  }

  $getStaticServicePath() {
    return Promise.resolve('http://localhost:57889');
  }
}
