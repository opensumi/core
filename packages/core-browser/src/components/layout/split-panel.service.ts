import React from 'react';

import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { Deferred, Disposable, IDisposable } from '@opensumi/ide-core-common';

import { AppConfig, SlotRenderer } from '../../react-providers';
import { RESIZE_LOCK } from '../resize/resize';

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
  checkChildNoResize(child: React.ReactNode): boolean;
  setRootNode(node: HTMLElement): void;
  whenReady: Promise<void>;
}

@Injectable({ multiple: true })
export class SplitPanelService extends Disposable implements ISplitPanelService {
  @Autowired(AppConfig)
  appConfig: AppConfig;

  constructor(protected readonly panelId: string) {
    super();
  }

  private _whenReadyDeferred: Deferred<void> = new Deferred();

  panels: HTMLElement[] = [];

  rootNode: HTMLElement | undefined;

  get isVisible(): boolean {
    return (this.rootNode && this.rootNode.clientHeight > 0) || false;
  }

  get whenReady() {
    return this._whenReadyDeferred.promise;
  }

  setRootNode(node: HTMLElement) {
    this.rootNode = node;
    this._whenReadyDeferred.resolve();
  }

  getFirstResizablePanel(index: number, direction: boolean, isPrev?: boolean): HTMLElement | undefined {
    if (isPrev) {
      if (direction) {
        for (let i = index; i >= 0; i--) {
          if (!this.panels[i].classList.contains(RESIZE_LOCK)) {
            // 跳过无法调整的面板
            return this.panels[i];
          }
        }
      } else {
        for (let i = index; i >= 0; i--) {
          if (!this.panels[i].classList.contains(RESIZE_LOCK)) {
            return this.panels[i];
          }
        }
      }
    } else {
      if (!direction) {
        for (let i = index + 1; i < this.panels.length; i++) {
          if (!this.panels[i].classList.contains(RESIZE_LOCK)) {
            // 跳过无法调整的面板
            return this.panels[i];
          }
        }
      } else {
        for (let i = index + 1; i < this.panels.length; i++) {
          if (!this.panels[i].classList.contains(RESIZE_LOCK)) {
            return this.panels[i];
          }
        }
      }
    }
  }

  checkChildNoResize(child: React.ReactNode) {
    if (child && (child as React.ReactElement).type === SlotRenderer) {
      // slot render must have modules
      const modules = this.appConfig.layoutConfig[(child as React.ReactElement).props?.slot]?.modules;
      if (!modules || modules.length === 0) {
        return true;
      }
    }
    return false;
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
