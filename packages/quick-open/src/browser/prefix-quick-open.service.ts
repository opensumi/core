/********************************************************************************
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
// Some code copued and modified from https://github.com/eclipse-theia/theia/tree/v1.14.0/packages/core/src/browser/quick-open/prefix-quick-open-service.ts

import { localize, QuickOpenActionProvider } from '@ali/ide-core-browser';
import { DisposableCollection, IDisposable, Disposable, ILogger } from '@ali/ide-core-common';
import { IQuickOpenHandlerRegistry, QuickOpenHandler, QuickOpenOptions, QuickOpenService, QuickOpenItem, PrefixQuickOpenService } from './quick-open.model';
import { Injectable, Autowired } from '@ali/common-di';
import { QuickTitleBar } from './quick-title-bar';
/**
 * @deprecated import from `@ali/ide-core-browser/lib/quick-open` instead
 */
export { QuickOpenContribution, QuickOpenHandler, IQuickOpenHandlerRegistry } from './quick-open.model';

@Injectable()
export class QuickOpenHandlerRegistry extends Disposable implements IQuickOpenHandlerRegistry {
  protected readonly handlers: Map<string, QuickOpenHandler> = new Map();
  protected defaultHandler: QuickOpenHandler | undefined;

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  registerHandler(handler: QuickOpenHandler): IDisposable {
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
}

@Injectable()
export class PrefixQuickOpenServiceImpl implements PrefixQuickOpenService {

  @Autowired(QuickOpenHandlerRegistry)
  protected readonly handlers: QuickOpenHandlerRegistry;

  @Autowired(QuickOpenService)
  protected readonly quickOpenService: QuickOpenService;

  @Autowired(QuickTitleBar)
  protected readonly quickTitleBar: QuickTitleBar;

  open(prefix: string): void {
    const handler = this.handlers.getHandlerOrDefault(prefix);
    this.setCurrentHandler(prefix, handler);
  }

  protected toDisposeCurrent = new DisposableCollection();
  protected currentHandler: QuickOpenHandler | undefined;

  protected async setCurrentHandler(prefix: string, handler: QuickOpenHandler | undefined): Promise<void> {
    if (handler !== this.currentHandler) {
      this.toDisposeCurrent.dispose();
      this.currentHandler = handler;
      this.toDisposeCurrent.push(Disposable.create(() => {
        const closingHandler = handler && handler.getOptions().onClose;
        if (closingHandler) {
          closingHandler(true);
        }
      }));
    }
    if (!handler) {
      this.doOpen();
      return;
    }
    if (handler.init) {
      await handler.init();
    }
    let optionsPrefix = prefix;
    if (this.handlers.isDefaultHandler(handler) && prefix.startsWith(handler.prefix)) {
      optionsPrefix = prefix.substr(handler.prefix.length);
    }
    const skipPrefix = this.handlers.isDefaultHandler(handler) ? 0 : handler.prefix.length;
    const handlerOptions = handler.getOptions();
    this.doOpen({
      prefix: optionsPrefix,
      skipPrefix,
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
    });
  }

  protected doOpen(options?: QuickOpenOptions): void {

    if (this.quickTitleBar.isAttached) {
      this.quickTitleBar.hide();
    }

    this.quickOpenService.open({
      onType: (lookFor, acceptor) => this.onType(lookFor, acceptor),
    }, options);
  }

  protected onType(lookFor: string, acceptor: (items: QuickOpenItem[], actionProvider?: QuickOpenActionProvider) => void): void {
    const handler = this.handlers.getHandlerOrDefault(lookFor);
    if (handler === undefined) {
        const items: QuickOpenItem[] = [];
        items.push(new QuickOpenItem({
            label: localize('quickopen.command.nohandler'),
        }));
        acceptor(items);
    } else if (handler !== this.currentHandler) {
        this.setCurrentHandler(lookFor, handler);
    } else {
        const handlerModel = handler.getModel();
        const searchValue = this.handlers.isDefaultHandler(handler) ? lookFor : lookFor.substr(handler.prefix.length);
        handlerModel.onType(searchValue, (items, actionProvider) => acceptor(items, actionProvider));
    }
  }
}
