import * as React from 'react';
import { renderApp } from '@ali/ide-dev-tool/src/dev-app';
import { StatusBarModule } from '../src/browser';
import { Injectable } from '@ali/common-di';
import { SlotMap, SlotLocation, SlotRenderer } from '@ali/ide-core-browser';
import { BrowserModule, CommandRegistry, Command } from '@ali/ide-core-browser';
import { SlotLocation as LayoutSlotLocation } from '@ali/ide-main-layout';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { StatusBar, StatusBarAlignment } from '@ali/ide-status-bar/lib/browser/status-bar.service';
import * as styles from './app.module.less';

const ALERT_COMMAND: Command = {
  id: 'console.command',
};

const StatusBarDemo = observer(() => {

  const [count, setCount] = React.useState(0);
  const statusBar: StatusBar = useInjectable(StatusBar);
  const commandRegistry = useInjectable(CommandRegistry);

  React.useEffect(() => {
    // mock command
    commandRegistry.registerCommand(ALERT_COMMAND, {
      execute(args) {
        alert('execute command: ' + args);
      },
    });

    statusBar.addElement('kaitian', {
      text: 'kaitian',
      color: '#ffffff',
      alignment: StatusBarAlignment.LEFT,
      command: ALERT_COMMAND.id,
      arguments: ['kaitian'],
    });
  }, []);

  function addCodeFork() {
    statusBar.addElement('code-fork-' + count, {
      text: 'ide-' + count,
      icon: 'github',
      alignment: StatusBarAlignment.LEFT,
      tooltip: 'git-branch tooltip',
      priority: 100,
      onClick: () => {
        console.log('click git');
      },
    });

    setCount(count + 1);
  }

  function setColor() {
    statusBar.addElement('color-button', {
      text: 'color button',
      alignment: StatusBarAlignment.LEFT,
      color: 'red',
    });
  }

  function setBgAndColor() {
    statusBar.setBackgroundColor('#ffb300');
    statusBar.setColor('#212121');
  }

  function setText() {
    statusBar.setElement('kaitian', {
      text: '开天',
    });
  }
  return (
    <div className={styles.container}>
      <div className={styles.panel}>
        <div>demo</div>
        <div className={styles.buttons}>
          <button onClick={addCodeFork}>新增按钮</button>
          <button onClick={setColor}>设置有颜色的按钮</button>
          <button onClick={setBgAndColor}>设置背景和文字颜色</button>
          <button onClick={setText}>设置开天的文字</button>
        </div>
      </div>
      <SlotRenderer name={LayoutSlotLocation.statusBar}></SlotRenderer>
    </div>
  );
});

@Injectable()
class StatusBarTestModule extends BrowserModule {
  slotMap: SlotMap = new Map([
    [ SlotLocation.main, StatusBarDemo],
  ]);
}

renderApp({
  modules: [ StatusBarTestModule, StatusBarModule ],
});
