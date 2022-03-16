import { QuickOpenService, VariableRegistry, Variable, URI } from '@opensumi/ide-core-browser';
import { MockQuickOpenService } from '@opensumi/ide-quick-open/lib/common/mocks/quick-open.service';
import { VariableModule } from '@opensumi/ide-variable/lib/browser';
import { IVariableResolverService } from '@opensumi/ide-variable/lib/common';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';

describe('VariableResolverService should be work', () => {
  let variableResolverService: IVariableResolverService;
  let variableRegistry: VariableRegistry;
  let injector: MockInjector;
  const workspaceRoot = URI.file('test').toString();
  const currentName = 'Resolver Test Case';

  beforeEach(() => {
    injector = createBrowserInjector([VariableModule]);

    injector.addProviders({
      token: QuickOpenService,
      useClass: MockQuickOpenService,
    });
    variableResolverService = injector.get(IVariableResolverService);

    variableRegistry = injector.get(VariableRegistry);

    const variables: Variable[] = [
      {
        name: 'root',
        description: 'current workspace uri',
        resolve: () => Promise.resolve(workspaceRoot),
      },
      {
        name: 'name',
        description: 'current name',
        resolve: () => Promise.resolve(currentName),
      },
    ];
    variables.forEach((v) => variableRegistry.registerVariable(v));

    // register once again to loop the resolve function
    // should be reject and use pre register value
    variableRegistry.registerVariable(variables[0]);
  });

  describe('01 #Init', () => {
    it('should have enough API', async () => {
      expect(typeof variableResolverService.resolve).toBe('function');
      expect(typeof variableResolverService.resolveArray).toBe('function');
    });
  });

  describe('02 #API should be worked.', () => {
    it('should resolve known variables in a text', async (done) => {
      const resolved = await variableResolverService.resolve<string>('root: ${root}');
      expect(resolved).toBe(`root: ${workspaceRoot}`);
      done();
    });

    it('should resolve known variables in a array', async (done) => {
      const variableArray = ['root: ${root}'];
      const resolved = await variableResolverService.resolve(variableArray);
      expect(resolved[0]).toBe(`root: ${workspaceRoot}`);
      done();
    });

    it('should resolve known variables in a object', async (done) => {
      const variableObject = { root: '${root}' };
      const resolved = await variableResolverService.resolve(variableObject);
      expect(resolved.root).toBe(`${workspaceRoot}`);
      done();
    });

    it('should resolve known variables in a string array', async () => {
      const resolved = await variableResolverService.resolveArray(['name: ${name}', 'root: ${root}']);
      expect(resolved.length).toBe(2);
      expect(resolved.indexOf(`name: ${currentName}`) >= 0).toBeTruthy();
      expect(resolved.indexOf(`root: ${workspaceRoot}`) >= 0).toBeTruthy();
    });

    it('should resolve undefined variables', async () => {
      const resolved = await variableResolverService.resolve(undefined);
      expect(resolved).toBeUndefined();
    });

    it('should skip unknown variables', async () => {
      const resolved = await variableResolverService.resolve('name: ${name}; root: ${root}; unkown: ${unkown}');
      expect(resolved).toBe(`name: ${currentName}; root: ${workspaceRoot}; unkown: \${unkown}`);
    });
  });
});
