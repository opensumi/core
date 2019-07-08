import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { VscodeExtensionModule } from '@ali/ide-vscode-extension/lib/browser';
import { VscodeExtensionType } from '@ali/ide-vscode-extension/lib/browser/vscode.extension';
import { join } from 'path';

describe('vscode extension basic' , () => {

  it('should recoginze vscode extension', () => {
    const injector = createBrowserInjector([VscodeExtensionModule]);

    const vscodeType = injector.get(VscodeExtensionType);

    const exampleVscodePackageJSONs = require(join(__dirname, 'packageJSONs.json')) as any[];

    exampleVscodePackageJSONs.forEach((packageJSON) => {
      expect(vscodeType.isThisType(packageJSON)).toBeTruthy();
    });
  });
});
