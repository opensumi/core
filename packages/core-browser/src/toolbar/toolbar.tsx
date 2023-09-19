import classnames from 'classnames';
import throttle from 'lodash/throttle';
import React from 'react';
import ReactDOM from 'react-dom';

import { IEventBus, Disposable, Emitter } from '@opensumi/ide-core-common';

import { DomListener } from '../dom';
import { AbstractMenuService, MenuId, generateCtxMenu, ICtxMenuRenderer } from '../menu/next';
import { PreferenceService } from '../preferences';
import { useInjectable } from '../react-hooks';
import { ConfigContext, ConfigProvider, AppConfig } from '../react-providers/config-provider';
import { getIcon } from '../style/icon/icon';

import {
  IToolbarRegistry,
  ToolbarActionGroupsChangedEvent,
  IToolbarAction,
  ISize,
  ToolbarActionsChangedEvent,
  IToolbarLocationProps,
  IToolbarLocationPreference,
  IToolbarActionElementProps,
  ToolbarRegistryReadyEvent,
  ToolbarActionsWhenChangeEvent,
} from './types';

export const DEFAULT_TOOLBAR_ACTION_MARGIN = 5;
export const DEFAULT_TOOLBAR_MORE_WIDTH = 14;

declare let ResizeObserver: any;

const renderedActions = new Map<string, ToolbarActionRenderer>();

const elementSizeDiffEmitter: Emitter<string> = new Emitter();

const dropDownShouldCloseEmitter: Emitter<string> = new Emitter();

export const ToolbarLocation = (props: IToolbarLocationProps & React.HTMLAttributes<HTMLDivElement>) => {
  const registry: IToolbarRegistry = useInjectable(IToolbarRegistry);
  const menuService: AbstractMenuService = useInjectable(AbstractMenuService);
  const contextMenuRenderer: ICtxMenuRenderer = useInjectable(ICtxMenuRenderer);
  if (!registry.hasLocation(props.location)) {
    registry.addLocation(props.location);
  }
  const context: AppConfig = React.useContext(ConfigContext);
  const eventBus: IEventBus = useInjectable(IEventBus);
  const container = React.useRef<HTMLDivElement>();
  const preferenceService: PreferenceService = useInjectable(PreferenceService);
  const { location, preferences = {} } = props;
  let ignoreActions: string[];
  const setIgnoreActions = (v) => {
    ignoreActions = v.slice();
  };
  setIgnoreActions(
    (preferenceService.get<{ [location: string]: string[] }>('toolbar.ignoreActions', {}) || {})[location] || [],
  );

  const shouldListenInitialization = !registry.isReady();

  React.useEffect(() => {
    if (container.current) {
      const disposer = new Disposable();
      const debouncedUpdate = throttle(() => {
        updateNow();
      }, 200);
      const updateNow = () => {
        if (container.current) {
          setIgnoreActions(
            (preferenceService.get<{ [location: string]: string[] }>('toolbar.ignoreActions', {}) || {})[location] ||
              [],
          );
          renderToolbarLocation(container.current, location, preferences, registry, context, ignoreActions);
        }
      };
      if (shouldListenInitialization) {
        disposer.addDispose(
          eventBus.once(ToolbarRegistryReadyEvent, (e) => {
            updateNow();
          }),
        );
      }
      disposer.addDispose(
        eventBus.on(ToolbarActionsWhenChangeEvent, () => {
          updateNow();
        }),
      );
      disposer.addDispose(
        eventBus.on(ToolbarActionGroupsChangedEvent, (e) => {
          if (e.payload.location === location) {
            debouncedUpdate();
          }
        }),
      );
      disposer.addDispose(
        eventBus.on(ToolbarActionsChangedEvent, (e) => {
          if (e.payload.position.location === location) {
            debouncedUpdate();
          }
        }),
      );
      disposer.addDispose(
        elementSizeDiffEmitter.event((actionId) => {
          const position = registry.getActionPosition(actionId);
          if (position && position.location === location) {
            debouncedUpdate();
          }
        }),
      );
      disposer.addDispose(
        preferenceService.onPreferenceChanged((e) => {
          if (e.preferenceName === 'toolbar.ignoreActions') {
            const newValue =
              (preferenceService.get<{ [location: string]: string[] }>('toolbar.ignoreActions', {}) || {})[location] ||
              [];
            // 如果两个数组存在不同，刷新
            for (const id of newValue) {
              if (ignoreActions.indexOf(id) === -1) {
                updateNow();
                return;
              }
            }
            for (const id of ignoreActions) {
              if (newValue.indexOf(id) === -1) {
                updateNow();
                return;
              }
            }
          }
        }),
      );
      if (!preferences.noDropDown) {
        let previousWidth = container.current.offsetWidth;
        renderToolbarLocation(container.current, location, preferences, registry, context, ignoreActions);
        const observer = new ResizeObserver((entries) => {
          const contentRect = entries[0].contentRect;
          if (contentRect.width !== previousWidth) {
            debouncedUpdate();
          }
          previousWidth = contentRect.width;
        });
        observer.observe(container.current);
        disposer.addDispose({
          dispose: () => observer.disconnect(),
        });
      } else {
        renderToolbarLocation(container.current, location, preferences, registry, context, ignoreActions);
      }
      return () => disposer.dispose();
    }
  }, [preferences.noDropDown]);

  return (
    <div
      {...props}
      className={classnames('kt-toolbar-location', props.className)}
      id={'toolbar-location-' + location}
      ref={container as any}
      onContextMenu={(event: React.MouseEvent<HTMLElement>) => {
        if (
          event.nativeEvent
            .composedPath()
            .find((e) => (e as any).getAttribute && (e as any).getAttribute('data-toolbar-no-context'))
        ) {
          return;
        }
        event.preventDefault();
        const menus = menuService.createMenu(MenuId.KTToolbarLocationContext);
        const menuNodes = generateCtxMenu({ menus });
        contextMenuRenderer.show({
          menuNodes: menuNodes[1],
          anchor: {
            x: event.clientX,
            y: event.clientY,
          },
        });
      }}
    ></div>
  );
};

interface ActionSplit {
  type: 'split';
}

function isActionSplit(target: IToolbarAction | ActionSplit): target is ActionSplit {
  return (target as ActionSplit).type === 'split';
}

interface IResolvedToolbarAction {
  action: IToolbarAction;
  marginLeft: number;
  extraClassNames?: string[];
  noGroupSplit?: boolean;
}

interface IResolvedToolbarActionOrSplit {
  action: IToolbarAction | ActionSplit;
  marginLeft: number;
  extraClassNames?: string[];
  noGroupSplit?: boolean;
}

function renderToolbarLocation(
  container: HTMLDivElement,
  location: string,
  preference: IToolbarLocationPreference,
  registry: IToolbarRegistry,
  context: AppConfig,
  ignoreActions: string[],
) {
  const TOOLBAR_ACTION_MARGIN =
    preference.actionMargin === undefined ? DEFAULT_TOOLBAR_ACTION_MARGIN : preference.actionMargin;
  const TOOLBAR_MORE_WIDTH =
    preference.moreActionWidth === undefined ? DEFAULT_TOOLBAR_MORE_WIDTH : preference.moreActionWidth;

  for (let i = 0; i < container.children.length; i++) {
    container.children[i].remove();
    i--;
  }

  const locationContainer = document.createElement('div');
  locationContainer.classList.add('kt-toolbar-location-visible');
  locationContainer.id = 'toolbar-location-visible-' + location;
  const dropDownId = 'toolbar-location-dropdown-' + location;
  let locationDropDownContainer: HTMLDivElement;
  if (document.getElementById(dropDownId)) {
    locationDropDownContainer = document.getElementById(dropDownId)! as HTMLDivElement;
    for (let i = 0; i < locationDropDownContainer.children.length; i++) {
      locationDropDownContainer.children[i].remove();
      i--;
    }
  } else {
    locationDropDownContainer = document.createElement('div');
    locationDropDownContainer.classList.add('kt-toolbar-location-dropdown');
    locationDropDownContainer.id = dropDownId;
  }
  container.append(locationContainer);
  document.body.append(locationDropDownContainer);

  const totalWidth = getContentWidth(locationContainer);
  let usedWidth = 0;

  const groups = ['_head', ...(registry.getActionGroups(location) || []).map((g) => g.id), '_tail'];

  const visibleActionsOrSplits: Array<IResolvedToolbarActionOrSplit> = [];
  const groupActions: IResolvedToolbarAction[][] = [];
  const dropDownActionsOrSplits: Array<IToolbarAction | ActionSplit> = [];

  for (const group of groups) {
    const result = registry.getToolbarActions({ location, group });
    const actions = result?.actions.filter((a) => ignoreActions.indexOf(a.id) === -1);
    if (actions && actions.length > 0) {
      if (
        visibleActionsOrSplits.length > 0 &&
        !visibleActionsOrSplits[visibleActionsOrSplits.length - 1].noGroupSplit
      ) {
        visibleActionsOrSplits.push({
          action: {
            type: 'split',
          },
          marginLeft: TOOLBAR_ACTION_MARGIN,
        });
      }
      const resolved = actions.map((action, i) => {
        const groupMargin = result!.group?.compact ? 0 : TOOLBAR_ACTION_MARGIN;
        const extraClassNames: string[] = [];
        if (result?.group?.compact) {
          extraClassNames.push('kt-toolbar-action-wrapper-compact');
          if (i === actions.length - 1) {
            extraClassNames.push('kt-toolbar-action-wrapper-compact-tail');
          }
          if (i === 0) {
            extraClassNames.push('kt-toolbar-action-wrapper-compact-head');
          }
          if (i !== 0 && i !== actions.length - 1) {
            extraClassNames.push('kt-toolbar-action-wrapper-compact-middle');
          }
        }

        return {
          action,
          marginLeft: i === 0 ? TOOLBAR_ACTION_MARGIN : groupMargin,
          extraClassNames,
          noGroupSplit: !!result!.group?.compact,
        };
      });
      visibleActionsOrSplits.push(...resolved);
      groupActions.push(resolved);
    }
  }

  if (visibleActionsOrSplits.length === 0) {
    locationContainer.classList.add('kt-toolbar-location-no-actions');
  } else {
    locationContainer.classList.remove('kt-toolbar-location-no-actions');
  }

  let shouldCollapse = false;

  if (!preference.noDropDown) {
    // 根据元素宽度计算哪些在外面，哪些在 dropdown
    for (let i = 0; i < visibleActionsOrSplits.length; i++) {
      const actionOrSplit = visibleActionsOrSplits[i];
      const elementWidth: number = getActionOrSplitWidth(actionOrSplit.action, false);

      if (!shouldCollapse) {
        if (
          usedWidth +
            (i !== 0 ? actionOrSplit.marginLeft : 0) +
            elementWidth +
            TOOLBAR_ACTION_MARGIN +
            TOOLBAR_MORE_WIDTH >
          totalWidth
        ) {
          // 此时，剩余的空间已经不足以容纳当前 action + more 按钮了
          // 判断当前 action 开始到最后的大小，是否小于 more 按钮的宽度
          let restWidth = 0;
          for (let j = i; j < visibleActionsOrSplits.length; j++) {
            restWidth +=
              (j !== 0 ? actionOrSplit.marginLeft : 0) + getActionOrSplitWidth(visibleActionsOrSplits[j].action, false);
          }
          if (restWidth < TOOLBAR_ACTION_MARGIN + TOOLBAR_MORE_WIDTH) {
            // 能容纳, 无需分组
            break;
          } else {
            // 不能容纳，先打标，继续循环以计算整个工具条的长度
            shouldCollapse = true;
          }
        }
      }
      usedWidth += (i !== 0 ? actionOrSplit.marginLeft : 0) + elementWidth;
    }
  }

  if (shouldCollapse) {
    // 由于需要collapse， 现在开始寻找合适的方式收起
    // 从右往左开始，尝试寻找能收起的元素，并将其放入dropDown元素中
    // 收集所有能被收集的元素的index
    const collapsableElementIndexes: [number, number][] = [];
    const dropdownGroupActions: IToolbarAction[][] = [];
    groupActions.forEach((group, gi) => {
      group.forEach((action, ai) => {
        if (!action.action.neverCollapse) {
          collapsableElementIndexes.push([gi, ai]);
        }
      });
      dropdownGroupActions.push([]);
    });

    // 反向pop出能收起的元素，看看去除后能否满足条件
    while (usedWidth + TOOLBAR_ACTION_MARGIN + TOOLBAR_MORE_WIDTH > totalWidth) {
      if (collapsableElementIndexes.length === 0) {
        // 此时已经再也无法满足条件，let it be
        break;
      }
      const nextElementIndex = collapsableElementIndexes.pop()!;
      // 虽然此处splice会改变index，但是由于我们是从后往前，所以问题不大
      const [action] = groupActions[nextElementIndex[0]].splice(nextElementIndex[1], 1);
      dropdownGroupActions[nextElementIndex[0]]!.push(action.action);
      // 去掉一个元素的宽度
      usedWidth -= TOOLBAR_ACTION_MARGIN + getActionOrSplitWidth(action.action, false);
      // 弹出后，如果groupActions为空且groupActions的group数量大于1，再去掉一个actionSplit的宽度
      if (groupActions.length > 1 && groupActions[nextElementIndex[0]].length === 0) {
        usedWidth -= TOOLBAR_ACTION_MARGIN + 1;
      }
    }
    // 获得此时的visibleActions和dropdownActions
    visibleActionsOrSplits.splice(0);
    const nonEmpty = groupActions.filter((g) => g.length > 0);
    nonEmpty.map((g, gi) => {
      if (gi !== 0 && !nonEmpty[gi - 1][0].noGroupSplit) {
        visibleActionsOrSplits.push({
          action: {
            type: 'split',
          },
          marginLeft: TOOLBAR_ACTION_MARGIN,
        });
      }
      visibleActionsOrSplits.push(...g);
    });

    dropDownActionsOrSplits.splice(0);
    dropdownGroupActions
      .reverse()
      .filter((g) => g.length > 0)
      .map((g, gi) => {
        if (gi !== 0) {
          dropDownActionsOrSplits.push({
            type: 'split',
          });
        }
        dropDownActionsOrSplits.push(...g);
      });
    dropDownActionsOrSplits.reverse();
  }

  // 开始渲染
  visibleActionsOrSplits.forEach((actionOrSplit) => {
    if (isActionSplit(actionOrSplit.action)) {
      const splitElement = document.createElement('div');
      splitElement.classList.add('kt-toolbar-action-split');
      locationContainer.append(splitElement);
    } else {
      appendActionToLocationContainer(
        locationContainer,
        actionOrSplit as IResolvedToolbarAction,
        context,
        false,
        location,
        preference,
      );
    }
  });

  if (dropDownActionsOrSplits.length > 0) {
    const moreElement = document.createElement('div');
    moreElement.classList.add('kt-toolbar-more');
    const moreLink = document.createElement('div');
    moreLink.classList.add(...getIcon('more').split(' '));
    moreElement.append(moreLink);
    locationContainer.append(moreElement);
    moreLink.addEventListener('mousedown', () => {
      toggleDropdown(moreElement, location);
    });
  }

  dropDownActionsOrSplits.forEach((actionOrSplit, i) => {
    if (isActionSplit(actionOrSplit)) {
      if (i === 0) {
        return;
      }
      const splitElement = document.createElement('div');
      splitElement.classList.add('kt-toolbar-action-split');
      locationDropDownContainer.appendChild(splitElement);
    } else {
      appendActionToLocationContainer(
        locationDropDownContainer,
        { action: actionOrSplit, marginLeft: 0 },
        context,
        true,
        location,
        preference,
      );
    }
  });
}

function toggleDropdown(ele, location: string) {
  const locationId = 'toolbar-location-visible-' + location;
  const dropDownId = 'toolbar-location-dropdown-' + location;
  const locationElement = document.getElementById(locationId);
  const dropDownElement = document.getElementById(dropDownId);
  if (locationElement && dropDownElement) {
    if (dropDownElement.style.display === 'block') {
      return;
    }
    const pos = locationElement.getBoundingClientRect();
    dropDownElement.style.top = pos.y + pos.height + 'px';
    dropDownElement.style.right = window.innerWidth - pos.x - pos.width + 'px';
    dropDownElement.style.display = 'block';
    setTimeout(() => {
      const disposer = new Disposable();
      disposer.addDispose(
        new DomListener(ele, 'mousedown', (e: MouseEvent) => {
          dropDownShouldCloseEmitter.fire(location);
          disposer.dispose();
          e.stopPropagation();
        }),
      );
      disposer.addDispose(
        new DomListener(dropDownElement, 'mousedown', (e: MouseEvent) => {
          e.stopPropagation();
        }),
      );
      disposer.addDispose(
        new DomListener(document.body, 'mousedown', (e: MouseEvent) => {
          disposer.dispose();
          dropDownElement.style.display = 'none';
        }),
      );
      disposer.addDispose(
        dropDownShouldCloseEmitter.event((locationName: string) => {
          if (locationName === location) {
            disposer.dispose();
            dropDownElement.style.display = 'none';
          }
        }),
      );
    });
  }
}

function getActionOrSplitWidth(actionOrSplit: IToolbarAction | ActionSplit, inDropDown: boolean) {
  if (isActionSplit(actionOrSplit)) {
    return 1;
  } else {
    // action 的计算逻辑
    const renderedSize = inDropDown
      ? renderedActions.get(actionOrSplit.id)?.size.inDropDown
      : renderedActions.get(actionOrSplit.id)?.size.visible;
    return renderedSize ? renderedSize.width : actionOrSplit.suggestSize ? actionOrSplit.suggestSize.width : 20;
  }
}

async function appendActionToLocationContainer(
  container: HTMLDivElement,
  toolbarAction: IResolvedToolbarAction,
  context: AppConfig,
  inDropDown: boolean,
  location: string,
  preferences?: IToolbarLocationPreference,
): Promise<void> {
  const actionContainer = document.createElement('div');
  container.appendChild(actionContainer);
  return rendererToolbarActionComponent(toolbarAction, actionContainer, context, inDropDown, location, preferences);
}

async function rendererToolbarActionComponent(
  toolbarAction: IResolvedToolbarAction,
  container: HTMLDivElement,
  context: AppConfig,
  inDropDown: boolean,
  location: string,
  preferences?: IToolbarLocationPreference,
): Promise<void> {
  if (!renderedActions.has(toolbarAction.action.id)) {
    renderedActions.set(toolbarAction.action.id, new ToolbarActionRenderer(toolbarAction, context));
  }
  return renderedActions.get(toolbarAction.action.id)!.attachTo(container, inDropDown, location, preferences);
}

function getContentWidth(element) {
  const styles = getComputedStyle(element);

  return element.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
}

class ToolbarActionRenderer {
  private renderPromise: {
    promise: Promise<HTMLDivElement>;
    cancel: () => void;
    inDropDown: boolean;
    resolved?: HTMLDivElement;
  };

  private targetContainer: HTMLDivElement | undefined;
  private targetInDropDown = false;
  public size: {
    visible?: ISize;
    inDropDown?: ISize;
  } = {};

  private reactElement: {
    element: HTMLDivElement | undefined;
    setInDropDown: (inDropDown: boolean) => void;
  };

  private toolbarAction: IToolbarAction;

  constructor(private resolvedToolbarAction: IResolvedToolbarAction, private context: AppConfig) {
    this.toolbarAction = resolvedToolbarAction.action;
  }

  render(inDropDown: boolean, location: string, preferences?: IToolbarLocationPreference): Promise<HTMLDivElement> {
    if (this.renderPromise) {
      if (this.renderPromise.inDropDown === inDropDown) {
        return this.renderPromise.promise;
      }
    }
    // 取消上一次渲染
    if (this.renderPromise) {
      this.renderPromise.cancel();
    }
    return this.doRender(inDropDown, location, preferences);
  }

  get element(): HTMLDivElement | undefined {
    return this.renderPromise && this.renderPromise.resolved;
  }

  attachTo(
    container: HTMLDivElement,
    inDropDown: boolean,
    location,
    preferences?: IToolbarLocationPreference,
  ): Promise<void> {
    this.targetContainer = container;
    this.targetInDropDown = inDropDown;
    return this.render(inDropDown, location, preferences).then((element) => {
      if (this.targetContainer === container && inDropDown === this.targetInDropDown) {
        if (element.parentElement) {
          element.remove();
        }
        container.replaceWith(element);
        setTimeout(() => {
          if (!element || element.offsetWidth === 0) {
            return;
          }
          let previousSize;
          if (inDropDown) {
            previousSize = this.size.inDropDown || this.toolbarAction.suggestSize || { width: 20, height: 30 };
            this.size.inDropDown = {
              width: element.offsetWidth,
              height: element.offsetHeight,
            };
          } else {
            previousSize = this.size.visible || this.toolbarAction.suggestSize || { width: 20, height: 30 };
            this.size.visible = {
              width: element.offsetWidth,
              height: element.offsetHeight,
            };
          }

          if (element.offsetWidth !== previousSize.width) {
            elementSizeDiffEmitter.fire(this.toolbarAction.id);
          }
        });
      }
    });
  }

  doRender(inDropDown, location: string, preferences?: IToolbarLocationPreference) {
    let canceled = false;
    this.renderPromise = {
      cancel: () => {
        canceled = true;
      },
      promise: new Promise<HTMLDivElement>((resolve, reject) => {
        if (this.reactElement) {
          this.reactElement.setInDropDown(inDropDown);
          resolve(this.reactElement.element!);
        } else {
          const element = document.createElement('div');
          element.classList.add('kt-toolbar-action-wrapper');
          element.setAttribute('data-toolbar-action-id', this.toolbarAction.id);
          if (this.resolvedToolbarAction.extraClassNames) {
            element.classList.add(...this.resolvedToolbarAction.extraClassNames);
          }
          let setInDropDown: (inDropDown: boolean) => void | undefined;
          ReactDOM.render(
            <ToolbarActionRenderWrapper
              initialInDropDown={inDropDown}
              action={this.toolbarAction}
              preferences={preferences}
              setInDropDownHandle={(handle) => (setInDropDown = handle)}
              context={this.context}
              component={this.toolbarAction.component}
              closeDropdown={() => {
                dropDownShouldCloseEmitter.fire(location);
              }}
              location={location}
            />,
            element,
            () => {
              if (canceled) {
                reject('canceled render toolbar');
              } else {
                this.reactElement = {
                  element,
                  setInDropDown: (inDropdown: boolean) => {
                    if (setInDropDown) {
                      setInDropDown(inDropdown);
                    }
                  },
                };
                resolve(element);
              }
            },
          );
        }
      }).then((resolved) => {
        this.renderPromise.resolved = resolved;
        return this.renderPromise.resolved;
      }),
      inDropDown,
    };
    return this.renderPromise.promise;
  }
}

export const ToolbarActionRenderWrapper = (props: {
  setInDropDownHandle: (setInDropDown: (inDropDown: boolean) => void) => void;
  initialInDropDown: boolean;
  component: React.FC<IToolbarActionElementProps> | React.ComponentClass<IToolbarActionElementProps>;
  context: AppConfig;
  action: IToolbarAction;
  closeDropdown: () => void;
  preferences?: IToolbarLocationPreference;
  location: string;
}) => {
  const [inDropDown, setInDropDown] = React.useState<boolean>(props.initialInDropDown);
  const C = props.component;
  React.useEffect(() => {
    props.setInDropDownHandle((inDropDown) => {
      setInDropDown(inDropDown);
    });
  }, []);
  return (
    <ConfigProvider value={props.context}>
      <C
        inDropDown={inDropDown}
        action={props.action}
        preferences={props.preferences}
        closeDropDown={props.closeDropdown}
        location={props.location}
      />
    </ConfigProvider>
  );
};
