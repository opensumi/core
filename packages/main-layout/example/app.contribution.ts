import { Autowired, Injectable } from '@ali/common-di';
import { ClientAppContribution, Domain } from '@ali/ide-core-browser';
import { StatusBar, StatusBarAlignment } from '@ali/ide-status-bar/lib/browser/status-bar.service';

@Domain(ClientAppContribution)
export class AppLogicContribution implements ClientAppContribution {

  @Autowired(StatusBar)
  statusBar: StatusBar;

  onStart() {
    this.statusBar.addElement('kaitian', {
      text: 'kaitian',
      icon: 'info-circle',
      alignment: StatusBarAlignment.LEFT,
      priority: 100,
      onClick: () => {
        alert('hello ide :)');
      },
    });
  }
}
