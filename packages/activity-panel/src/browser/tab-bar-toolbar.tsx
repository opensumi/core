/********************************************************************************
 * Copyright (C) 2018 TypeFox and others.
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

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import debounce = require('lodash.debounce');
import { Injectable, Autowired } from '@ali/common-di';
import { CommandService, CommandRegistry, DisposableCollection, Disposable, Event, Domain, ContributionProvider, Emitter } from '@ali/ide-core-common';
import { Widget } from '@phosphor/widgets';
import { IContextKeyService } from '@ali/ide-core-browser';
import { Message } from '@phosphor/messaging';

@Injectable()
class LabelParser {
  parse(text: string) {
    return text;
  }
}

/**
 * Factory for instantiating tab-bar toolbars.
 */
@Injectable()
export class TabBarToolbarFactory {
  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  @Autowired()
  labelParser: LabelParser;

  factory() {
    return new TabBarToolbar(this.commandService, this.commandRegistry, this.labelParser);
  }
}

/**
 * Tab-bar toolbar widget representing the active [tab-bar toolbar items](TabBarToolbarItem).
 */
export class TabBarToolbar extends Widget {

  protected current: Widget | undefined;
  protected items = new Map<string, TabBarToolbarItem>();
  protected readonly onRender = new DisposableCollection();
  protected readonly toDispose = new DisposableCollection();

  constructor(protected readonly commands: CommandService, protected commandRegistry: CommandRegistry, protected readonly labelParser: LabelParser) {
    super();
    this.addClass(TabBarToolbar.Styles.TAB_BAR_TOOLBAR);
    this.hide();
  }

  updateItems(items: Array<TabBarToolbarItem>, current: Widget | undefined): void {
    this.items = new Map(items.sort(TabBarToolbarItem.PRIORITY_COMPARATOR).reverse().map((item) => [item.id, item] as [string, TabBarToolbarItem]));
    this.setCurrent(current);
    if (!this.items.size) {
      this.hide();
    }
    this.onRender.push(Disposable.create(() => {
      if (this.items.size) {
        this.show();
      }
    }));
    this.update();
  }

  protected readonly toDisposeOnSetCurrent = new DisposableCollection();
  protected setCurrent(current: Widget | undefined): void {
    this.toDisposeOnSetCurrent.dispose();
    this.toDispose.push(this.toDisposeOnSetCurrent);
    this.current = current;
    if (current) {
      const resetCurrent = () => {
        this.setCurrent(undefined);
        this.update();
      };
      current.disposed.connect(resetCurrent);
      this.toDisposeOnSetCurrent.push(Disposable.create(() =>
        current.disposed.disconnect(resetCurrent),
      ));
    }
  }

  protected onUpdateRequest(msg: Message): void {
    super.onUpdateRequest(msg);
    ReactDOM.render(<React.Fragment>{this.render()}</React.Fragment>, this.node, () => this.onRender.dispose());
  }

  protected render(): React.ReactNode {
    return <React.Fragment>
      {[...this.items.values()].map((item) => this.renderItem(item))}
    </React.Fragment>;
  }

  protected renderItem(item: TabBarToolbarItem): React.ReactNode {
    const innerText = '';
    const classNames: string[] = [];
    if (item.text) {
      for (const labelPart of this.labelParser.parse(item.text)) {
        console.log(`TODO ${labelPart}图标转className实现`);
      }
    }
    const command = this.commandRegistry.getCommand(item.command);
    if (command) {
      const iconClass = command.iconClass;
      if (iconClass) {
        classNames.push(iconClass);
      }
    }
    return <div key={item.id} className={`${TabBarToolbar.Styles.TAB_BAR_TOOLBAR_ITEM}${command && this.commandIsEnabled(command.id) ? ' enabled' : ''}`} >
      <div id={item.id} className={classNames.join(' ')} onClick={this.executeCommand} title={item.tooltip}>{innerText}</div>
    </div>;
  }

  shouldHandleMouseEvent(event: MouseEvent): boolean {
    return event.target instanceof Element && !!this.items.get(event.target.id);
  }

  protected commandIsEnabled(command: string): boolean {
    // TODO command enable
    return true;
  }

  protected executeCommand = (e: React.MouseEvent<HTMLElement>) => {
    const item = this.items.get(e.currentTarget.id);
    if (TabBarToolbarItem.is(item)) {
      this.commands.executeCommand(item.command, this.current);
    }
  }

}

export namespace TabBarToolbar {

  export namespace Styles {

    export const TAB_BAR_TOOLBAR = 'p-TabBar-toolbar';
    export const TAB_BAR_TOOLBAR_ITEM = 'item';

  }

}

/**
 * Clients should implement this interface if they want to contribute to the tab-bar toolbar.
 */
export const TabBarToolbarContribution = Symbol('TabBarToolbarContribution');
export interface TabBarToolbarContribution {

  registerToolbarItems(registry: TabBarToolbarRegistry): void;

}

/**
 * Representation of an item in the tab
 */
export interface TabBarToolbarItem {

  /**
   * The unique ID of the toolbar item.
   */
  readonly id: string;

  /**
   * The command to execute.
   */
  readonly command: string;

  /**
   * Optional text of the item.
   *
   * Shamelessly copied and reused from `status-bar`:
   *
   * More details about the available `fontawesome` icons and CSS class names can be hound [here](http://fontawesome.io/icons/).
   * To set a text with icon use the following pattern in text string:
   * ```typescript
   * $(fontawesomeClassName)
   * ```
   *
   * To use animated icons use the following pattern:
   * ```typescript
   * $(fontawesomeClassName~typeOfAnimation)
   * ````
   * The type of animation can be either `spin` or `pulse`.
   * Look [here](http://fontawesome.io/examples/#animated) for more information to animated icons.
   */
  readonly text?: string;

  /**
   * Priority among the items. Can be negative. The smaller the number the left-most the item will be placed in the toolbar. It is `0` by default.
   */
  readonly priority?: number;

  /**
   * Optional group for the item.
   */
  readonly group?: string;

  /**
   * Optional tooltip for the item.
   */
  readonly tooltip?: string;

  /**
   * https://code.visualstudio.com/docs/getstarted/keybindings#_when-clause-contexts
   */
  readonly when?: string;

  /**
   * When defined, the container tool-bar will be updated if this event is fired.
   *
   * Note: currently, each item of the container toolbar will be re-rendered if any of the items have changed.
   */
  readonly onDidChange?: Event<void>;

}

export namespace TabBarToolbarItem {

  /**
   * Compares the items by `priority` in ascending. Undefined priorities will be treated as `0`.
   */
  export const PRIORITY_COMPARATOR = (left: TabBarToolbarItem, right: TabBarToolbarItem) => {
    // The navigation group is special as it will always be sorted to the top/beginning of a menu.
    if (left.group === 'navigation') {
      return -1;
    }
    if (right.group === 'navigation') {
      return 1;
    }
    if (left.group && right.group) {
      if (left.group < right.group) {
        return -1;
      } else if (left.group > right.group) {
        return 1;
      } else {
        return 0;
      }
    }
    if (left.group) {
      return -1;
    }
    if (right.group) {
      return 1;
    }
    return (left.priority || 0) - (right.priority || 0);
  };

  export function is(arg: object | undefined): arg is TabBarToolbarItem {
    // tslint:disable-next-line:no-any
    return !!arg && 'command' in arg && typeof (arg as any).command === 'string';
  }

}

/**
 * Main, shared registry for tab-bar toolbar items.
 */
@Injectable()
export class TabBarToolbarRegistry {

  protected items: Map<string, TabBarToolbarItem> = new Map();

  @Autowired(CommandRegistry)
  protected readonly commandRegistry: CommandRegistry;

  @Autowired(IContextKeyService)
  protected readonly contextKeyService: IContextKeyService;

  protected readonly onDidChangeEmitter = new Emitter<void>();
  readonly onDidChange: Event<void> = this.onDidChangeEmitter.event;
  // TODO debounce in order to avoid to fire more than once in the same tick
  protected fireOnDidChange: () => void = debounce(() => this.onDidChangeEmitter.fire(undefined), 0);

  /**
   * Registers the given item. Throws an error, if the corresponding command cannot be found or an item has been already registered for the desired command.
   *
   * @param item the item to register.
   */
  registerItem(item: TabBarToolbarItem): void {
    const { id } = item;
    if (this.items.has(id)) {
      throw new Error(`A toolbar item is already registered with the '${id}' ID.`);
    }
    this.items.set(id, item);
    this.fireOnDidChange();
    if (item.onDidChange) {
      item.onDidChange(() => this.fireOnDidChange());
    }
  }

  /**
   * Returns an array of tab-bar toolbar items which are visible when the `widget` argument is the current one.
   *
   * By default returns with all items where the command is enabled and `item.isVisible` is `true`.
   */
  visibleItems(widget: Widget): Array<TabBarToolbarItem> {
    const result: TabBarToolbarItem[] = [];
    for (const item of this.items.values()) {
      const visible = this.commandRegistry.isVisible(item.command, widget);
      // TODO 适配我们的context机制
      if (visible && (!item.when || this.contextKeyService.match(item.when, widget.node))) {
        result.push(item);
      }
    }
    return result;
  }

}
