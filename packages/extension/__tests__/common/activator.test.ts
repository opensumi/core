import { mockService } from '../../../../tools/dev-tool/src/mock-injector';
import { ExtensionsActivator, ActivatedExtension } from '../../src/common/activator';

describe(__filename, () => {
  let extensionsActivator: ExtensionsActivator;
  const mockActivatedExtension = new ActivatedExtension(
    'test',
    'test',
    'test',
    'node',
    false,
    null,
    mockService({}),
    mockService({}),
    [],
  );
  beforeEach(() => {
    extensionsActivator = new ExtensionsActivator();
  });

  it('set activate extension', () => {
    extensionsActivator.set('test', mockActivatedExtension);
    const extension = extensionsActivator.get('test')!;
    expect(extension).not.toBeUndefined();
    expect(extension.id).toBe('test');
    expect(extension.displayName).toBe('test');
  });

  it('delete activate extension', () => {
    extensionsActivator.set('test', mockActivatedExtension);
    expect(extensionsActivator.get('test')).not.toBeUndefined();
    extensionsActivator.delete('test');
    const extension = extensionsActivator.get('test');
    expect(extension).toBeUndefined();
  });

  it('get all activate extensions', () => {
    extensionsActivator.set('test', mockActivatedExtension);
    const allExtensions = extensionsActivator.all();
    expect(allExtensions).toHaveLength(1);
  });

  it('activator will catch if deactivate throw error', async () => {
    extensionsActivator.set(
      'test',
      new ActivatedExtension(
        'test',
        'test',
        'test',
        'node',
        false,
        null,
        mockService({
          deactivate: async () => {
            throw new Error('error');
          },
        }),
        mockService({}),
        [],
      ),
    );
    // deactivate 会 catch 中所有错误
    await expect(extensionsActivator.deactivate()).resolves.toBeTruthy();
  });
});
