import { QuickOpenService, VariableRegistry, Variable, URI } from '@opensumi/ide-core-browser';
import { MockQuickOpenService } from '@opensumi/ide-quick-open/lib/common/mocks/quick-open.service';
import { VariableModule } from '@opensumi/ide-variable/lib/browser';
import {
  VariableQuickOpenService,
  VariableQuickOpenItem,
} from '@opensumi/ide-variable/lib/browser/variable-quick-open.service';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';

describe('VariableQuickOpenService should be work', () => {
  let variableQuickOpenService: VariableQuickOpenService;
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
    variableQuickOpenService = injector.get(VariableQuickOpenService);

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
  });

  describe('01 #Init', () => {
    it('should have enough API to be QuickOpenModel', async () => {
      expect(typeof variableQuickOpenService.open).toBe('function');
      expect(typeof variableQuickOpenService.onType).toBe('function');
    });
  });

  describe('02 #API should be worked.', () => {
    it('open api should be work', async (done) => {
      try {
        variableQuickOpenService.open();
      } catch (e) {}
      // hack test, cause the mock quickOpen Service will not call it.
      const mockAcceptor = jest.fn();
      variableQuickOpenService.onType('', mockAcceptor);
      expect(mockAcceptor).toBeCalledTimes(1);
      done();
    });

    it('VariableQuickOpenItem should be right', () => {
      const items = variableRegistry.getVariables().map((v) => new VariableQuickOpenItem(v.name, v.description));
      expect(items.length).toBe(2);
      expect(items[0].getLabel()).toBe('${root}');
      expect(items[0].getDetail()).toBe('current workspace uri');
      expect(items[0].run({} as any)).toBeFalsy();
    });
  });
});
