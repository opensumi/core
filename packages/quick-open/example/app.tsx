import * as React from 'react';
import { renderApp } from '@ali/ide-dev-tool/src/dev-app';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { BrowserModule, CommandRegistry, CommandService, EffectDomain } from '@ali/ide-core-browser';
import '@ali/ide-quick-open/lib/browser';
import '@ali/ide-monaco/lib/browser';

const QuickOpenDemo = observer(() => {

  const commandRegistry: CommandRegistry = useInjectable(CommandRegistry);
  const commandService: CommandService = useInjectable(CommandService);

  React.useEffect(() => {
    commandRegistry.registerCommand({
      id: 'test1',
      label: 'test1 label',
      category: 'test1 category',
    }, {
      execute() {
        alert('test1');
      },
    });

    commandRegistry.registerCommand({
      id: 'test11',
      label: 'test11 label',
      category: 'test1 category',
    }, {
      execute() {
        alert('test11');
      },
    });

    commandRegistry.registerCommand({
      id: 'test2',
      label: 'test2 label',
      category: 'test2 category',
    }, {
      execute() {
        alert('test2');
      },
    });

    openQuickOpen();
  }, []);

  function openQuickOpen() {
    commandService.executeCommand('quickCommand');
  }

  return (
    <div>
      <button onClick={openQuickOpen}>Open QuickOpenWidget</button>
    </div>
  );
});

@EffectDomain('quick-open-demo')
class QuickOpenTestModule extends BrowserModule {
  component = QuickOpenDemo;
}

const packageName = require('../package.json').name;
const monacoPackageName = '@ali/ide-monaco';

renderApp({
  modules: [ 'quick-open-demo', packageName, monacoPackageName ],
});
