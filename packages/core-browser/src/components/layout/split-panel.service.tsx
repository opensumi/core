import React from 'react';

import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { Disposable, IDisposable } from '@opensumi/ide-core-common';

import { SplitPanelProps } from './split-panel';


export const ISplitPanelService = Symbol('ISplitPanelService');
export interface ISplitPanelService extends IDisposable {
  panels: HTMLElement[];
  rootNode: HTMLElement | undefined;
  isVisible: boolean;
  getFirstResizablePanel(index: number, direction: boolean, isPrev?: boolean): HTMLElement | undefined;
  renderSplitPanel(
    component: React.JSX.Element,
    children: React.ReactNode[],
    props: SplitPanelProps,
  ): React.ReactElement;
  interceptProps(props: SplitPanelProps): SplitPanelProps;
}

@Injectable({ multiple: true })
export class SplitPanelService extends Disposable implements ISplitPanelService {
  private static MIN_SIZE = 120;
  constructor(protected readonly panelId: string) {
    super();
  }

  panels: HTMLElement[] = [];

  rootNode: HTMLElement | undefined;

  get isVisible(): boolean {
    return (this.rootNode && this.rootNode.clientHeight > 0) || false;
  }

  getFirstResizablePanel(index: number, direction: boolean, isPrev?: boolean): HTMLElement | undefined {
    if (isPrev) {
      if (direction) {
        return this.panels[index];
      } else {
        for (let i = index; i >= 0; i--) {
          if (this.panels[i].clientHeight > SplitPanelService.MIN_SIZE) {
            return this.panels[i];
          }
        }
      }
    } else {
      if (!direction) {
        return this.panels[index + 1];
      } else {
        for (let i = index + 1; i < this.panels.length; i++) {
          if (this.panels[i].clientHeight > SplitPanelService.MIN_SIZE) {
            return this.panels[i];
          }
        }
      }
    }
  }

  public renderSplitPanel(component: React.JSX.Element, children: React.ReactNode[], props: SplitPanelProps) {
    return React.cloneElement(component, { ...props, ...component.props }, children);
  }

  public interceptProps(props: SplitPanelProps): SplitPanelProps {
    return props;
  }
}

@Injectable()
export class SplitPanelManager {
  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  services: Map<string, ISplitPanelService> = new Map();

  getService(panelId: string) {
    let service = this.services.get(panelId);
    if (!service) {
      service = this.injector.get(ISplitPanelService, [panelId]);
      this.services.set(panelId, service!);
    }
    return service!;
  }
}
