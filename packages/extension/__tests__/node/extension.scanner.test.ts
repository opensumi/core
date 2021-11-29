import { ExtensionScanner } from '../../src/node/extension.scanner';

describe('ExtensionScanner', () => {
  describe('ExtensionScanner.getExtensionIdByExtensionPath', () => {
    it('can read publisher.name', () => {
      const extensionPath = '~/extensions/cloud-ide.debug-1.0.0';
      const extensionId = ExtensionScanner.getExtensionIdByExtensionPath(extensionPath);
      expect(extensionId).toEqual('cloud-ide.debug');
    });

    it('can read publisher.name and give version', () => {
      const extensionPath = '~/extensions/cloud-ide.debug-lite-1.0.0';
      const extensionId = ExtensionScanner.getExtensionIdByExtensionPath(extensionPath, '1.0.0');
      expect(extensionId).toEqual('cloud-ide.debug-lite');
    });

    it('can read extensionId', () => {
      const extensionPath = '~/extensions/5da45c36392bdd7063eb0e11-configuration-editing-1.0.0';
      const extensionId = ExtensionScanner.getExtensionIdByExtensionPath(extensionPath);
      expect(extensionId).toEqual('5da45c36392bdd7063eb0e11');
    });
  });
});
