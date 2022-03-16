/** ******************************************************************************
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

// Some code copied and modified from https://github.com/eclipse-theia/theia/tree/v1.14.0/packages/core/src/browser/quick-open/prefix-quick-open-service.ts

import React from 'react';

import { Injectable, Autowired } from '@opensumi/di';
import { localize, QuickOpenActionProvider } from '@opensumi/ide-core-browser';
import { CorePreferences } from '@opensumi/ide-core-browser/lib/core-preferences';
import {
  IQuickOpenHandlerRegistry,
  QuickOpenHandler,
  QuickOpenTabConfig,
  QuickOpenTab,
  QuickOpenOptions,
  QuickOpenService,
  QuickOpenItem,
  PrefixQuickOpenService,
} from '@opensumi/ide-core-browser/lib/quick-open';
import { DisposableCollection, IDisposable, Disposable, ILogger } from '@opensumi/ide-core-common';

import { QuickOpenTabs } from './components/quick-open-tabs';
import { QuickTitleBar } from './quick-title-bar';
/**
 * @deprecated import from `@opensumi/ide-core-browser/lib/quick-open` instead
 */
export {
  QuickOpenContribution,
  QuickOpenHandler,
  IQuickOpenHandlerRegistry,
  QuickOpenTab,
} from '@opensumi/ide-core-browser/lib/quick-open';

@Injectable()
export class QuickOpenHandlerRegistry extends Disposable implements IQuickOpenHandlerRegistry {
  protected readonly handlers: Map<string, QuickOpenHandler> = new Map();
  protected tabs: QuickOpenTab[] = [];
  protected sortedTabs: QuickOpenTab[] | null = null;
  protected readonly handlerTabMap: Map<QuickOpenHandler, QuickOpenTab[]> = new Map();
  protected defaultHandler: QuickOpenHandler | undefined;

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  registerHandler(handler: QuickOpenHandler, tabConfig?: QuickOpenTabConfig): IDisposable {
    if (this.handlers.has(handler.prefix)) {
      this.logger.warn(`前缀是 ${handler.prefix} 的处理函数已经存在`);
      return Disposable.NULL;
    }
    this.handlers.set(handler.prefix, handler);
    const disposable = {
      dispose: () => this.handlers.delete(handler.prefix),
    };
    this.addDispose(disposable);

    if (handler.default) {
      this.defaultHandler = handler;
    }

    if (tabConfig) {
      const tabs: QuickOpenTab[] = [];
      const { sub, ...tabProps } = tabConfig;
      if (sub) {
        Object.keys(sub).forEach((subPrefix) => {
          tabs.push({
            prefix: `${handler.prefix}${subPrefix}`,
            ...sub[subPrefix],
          });
        });
      }
      tabs.push({
        prefix: handler.prefix,
        ...tabProps,
      });
      this.handlerTabMap.set(handler, tabs);
      this.tabs.push(...tabs);
      this.sortedTabs = null;
      this.addDispose({
        dispose: () => {
          const removeTabs = this.handlerTabMap.get(handler);
          if (removeTabs) {
            this.handlerTabMap.delete(handler);
            this.tabs = this.tabs.filter((tab) => !removeTabs.includes(tab));
            this.sortedTabs = null;
          }
        },
      });
    }

    return disposable;
  }

  getDefaultHandler(): QuickOpenHandler | undefined {
    return this.defaultHandler;
  }

  isDefaultHandler(handler: QuickOpenHandler): boolean {
    return handler === this.getDefaultHandler();
  }

  getHandlers(): QuickOpenHandler[] {
    return [...this.handlers.values()];
  }

  getHandlerOrDefault(text: string): QuickOpenHandler | undefined {
    for (const handler of this.handlers.values()) {
      if (text.startsWith(handler.prefix)) {
        return handler;
      }
    }
    return this.getDefaultHandler();
  }

  getSortedTabs() {
    if (!this.sortedTabs) {
      this.sortedTabs = this.tabs.slice().sort((t1, t2) => t1.order - t2.order);
    }
    return this.sortedTabs;
  }

  getTabByHandler(handler: QuickOpenHandler, lookFor: string) {
    if (this.handlerTabMap.has(handler)) {
      let prefix = lookFor;
      if (this.isDefaultHandler(handler) && !lookFor.startsWith(handler.prefix)) {
        prefix = `${handler.prefix}${lookFor}`;
      }
      return this.handlerTabMap.get(handler)!.find((tab) => prefix.startsWith(tab.prefix));
    }
  }
}

@Injectable()
export class PrefixQuickOpenServiceImpl implements PrefixQuickOpenService {
  @Autowired(QuickOpenHandlerRegistry)
  protected readonly handlers: QuickOpenHandlerRegistry;

  @Autowired(QuickOpenService)
  protected readonly quickOpenService: QuickOpenService;

  @Autowired(QuickTitleBar)
  protected readonly quickTitleBar: QuickTitleBar;

  @Autowired(CorePreferences)
  private readonly corePreferences: CorePreferences;

  private activePrefix = '';

  private currentLookFor = '';

  open(prefix: string): void {
    const handler = this.handlers.getHandlerOrDefault(prefix);
    // 恢复同一 tab 上次的输入，连续输入相同的快捷键也可以保留历史输入
    let shouldSelect = false;
    if (
      this.corePreferences['workbench.quickOpen.preserveInput'] &&
      handler &&
      handler === this.currentHandler &&
      this.currentLookFor &&
      // 同一 handler，不同 tab 切换需要重置
      this.handlers.getTabByHandler(handler, this.currentLookFor) === this.handlers.getTabByHandler(handler, prefix)
    ) {
      prefix = this.currentLookFor;
      shouldSelect = true;
    } else {
      this.currentLookFor = '';
    }
    this.setCurrentHandler(prefix, handler, shouldSelect);
  }

  protected toDisposeCurrent = new DisposableCollection();
  protected currentHandler: QuickOpenHandler | undefined;

  protected async setCurrentHandler(
    prefix: string,
    handler: QuickOpenHandler | undefined,
    select?: boolean,
  ): Promise<void> {
    if (handler !== this.currentHandler) {
      this.toDisposeCurrent.dispose();
      this.currentHandler = handler;
      this.toDisposeCurrent.push(
        Disposable.create(() => {
          const closingHandler = handler && handler.getOptions().onClose;
          if (closingHandler) {
            closingHandler(true);
          }
        }),
      );
    }
    if (!handler) {
      this.doOpen();
      return;
    }
    if (handler.init) {
      await handler.init();
    }

    this.setActivePrefix(handler, prefix);

    let optionsPrefix = prefix;
    if (this.handlers.isDefaultHandler(handler) && prefix.startsWith(handler.prefix)) {
      optionsPrefix = prefix.substr(handler.prefix.length);
    }
    const skipPrefix = this.handlers.isDefaultHandler(handler)
      ? 0
      : (this.handlers.getTabByHandler(handler, prefix)?.prefix ?? handler.prefix).length;
    const handlerOptions = handler.getOptions();
    this.doOpen({
      prefix: optionsPrefix,
      skipPrefix,
      valueSelection: select ? [skipPrefix, prefix.length] : undefined,
      ...handlerOptions,
      onClose: (canceled: boolean) => {
        if (handlerOptions.onClose) {
          handlerOptions.onClose(canceled);
        }
        // 最后 prefix-quick 执行
        if (handler.onClose) {
          handler.onClose(canceled);
        }
      },
      renderTab: () =>
        React.createElement(QuickOpenTabs, {
          tabs: this.handlers.getSortedTabs(),
          activePrefix: this.activePrefix,
          onChange: (prefix) => {
            handler.onToggle?.();
            this.open(prefix);
          },
        }),
      toggleTab: () => {
        handler.onToggle?.();
        const tabs = this.handlers.getSortedTabs();
        let nextTab: QuickOpenTab | null = null;
        if (this.activePrefix) {
          let index = tabs.findIndex((t) => t.prefix === this.activePrefix);
          index = index === tabs.length - 1 ? 0 : index + 1;
          nextTab = tabs[index];
        } else {
          nextTab = tabs[0];
        }
        if (nextTab) {
          this.open(nextTab.prefix);
        }
      },
    });
  }

  protected doOpen(options?: QuickOpenOptions): void {
    if (this.quickTitleBar.isAttached) {
      this.quickTitleBar.hide();
    }

    this.quickOpenService.open(
      {
        onType: (lookFor, acceptor) => this.onType(lookFor, acceptor),
      },
      options,
    );
  }

  protected onType(
    lookFor: string,
    acceptor: (items: QuickOpenItem[], actionProvider?: QuickOpenActionProvider) => void,
  ): void {
    this.currentLookFor = lookFor;
    const handler = this.handlers.getHandlerOrDefault(lookFor);
    if (handler === undefined) {
      const items: QuickOpenItem[] = [];
      items.push(
        new QuickOpenItem({
          label: localize('quickopen.command.nohandler'),
        }),
      );
      acceptor(items);
    } else if (handler !== this.currentHandler) {
      this.setCurrentHandler(lookFor, handler);
    } else {
      const handlerModel = handler.getModel();
      const searchValue = this.handlers.isDefaultHandler(handler) ? lookFor : lookFor.substr(handler.prefix.length);
      handlerModel.onType(searchValue, (items, actionProvider) => acceptor(items, actionProvider));
      this.setActivePrefix(handler, lookFor);
    }
  }

  private setActivePrefix(handler: QuickOpenHandler, lookFor: string) {
    this.activePrefix = this.handlers.getTabByHandler(handler, lookFor)?.prefix ?? '';
  }
}
