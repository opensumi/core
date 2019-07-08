import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { VscodeContributesRunner } from '@ali/ide-vscode-extension/lib/browser/contributes';
import { CommandsSchema, CommandsContributionPoint } from '@ali/ide-vscode-extension/lib/browser/contributes/commands';
import { CommandRegistry } from '@ali/ide-core-browser';

describe('vscode extension commands contribution test', () => {

  const injector = createBrowserInjector([]);

  const commandData1 = {
    title: '测试Command',
    command: 'test.command',
    category: 'testCategory',
  };

  const commandData2 = {
    title: '测试Command2',
    command: 'test.command2',
    category: 'testCategory',
  };

  const packageJSON: {
    contributes: {
      commands: CommandsSchema,
    },
  } = {
    contributes: {
      commands: [
        commandData1,
        commandData2,
      ],
    },
  };

  it('should be able to register commands', async () => {

    VscodeContributesRunner.ContributionPoints = [
      CommandsContributionPoint,
    ];

    const runner = injector.get(VscodeContributesRunner, [packageJSON.contributes as any]);

    await runner.run();

    const commandRegistry: CommandRegistry = injector.get(CommandRegistry);

    [commandData1, commandData2].forEach((data) => {
      const command = commandRegistry.getCommand(data.command);
      expect(command).not.toBeUndefined();
      expect(command!.label).toEqual(data.title);
      expect(command!.category).toEqual(data.category);
    });

  });

});
