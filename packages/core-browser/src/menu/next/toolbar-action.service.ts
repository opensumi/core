import { Injectable, Autowired } from '@opensumi/di';
import { IDisposable, Disposable } from '@opensumi/ide-core-common/lib/disposable';

import { IToolbarRegistry, createToolbarActionBtn } from '../../toolbar';
import { createToolbarActionSelect } from '../../toolbar/components/select';

interface IDescriptor {
  title: string;
  description?: string;
}

/**
 * @deprecated
 */
interface IToolbarAction extends IDescriptor {
  type: 'action';
  click: (args: any) => void;
  iconClass: string;
}

/**
 * @deprecated
 */
interface IToolbarSelect extends IDescriptor {
  type: 'enum';
  select: (value: string) => void;
  enum: string[];
  defaultValue?: string;
}

/**
 * @deprecated
 */
export type IToolbarActionGroup = Array<IToolbarAction | IToolbarSelect>;

/**
 * @deprecated
 */
export const IToolbarActionService = Symbol('IToolBarActionsService');

/**
 * @deprecated 使用 IToolbarRegistry 执行相关能力
 */
export interface IToolbarActionService {
  registryActionGroup(id: string, groups: IToolbarActionGroup): IDisposable;
  unRegistryActionGroup(id: string): void;
}

/**
 * @deprecated 使用 IToolbarRegistry 执行相关能力
 */
@Injectable()
export class ToolbarActionService extends Disposable implements IToolbarActionService {
  private groups = new Map<string, IDisposable>();

  @Autowired(IToolbarRegistry)
  registry: IToolbarRegistry;

  constructor() {
    super();
  }

  public registryActionGroup(id: string, group: IToolbarActionGroup): IDisposable {
    const disposer = new Disposable();

    disposer.addDispose(
      this.registry.registerToolbarActionGroup({
        id,
        preferredLocation: 'menu-right',
      }),
    );

    disposer.addDispose({
      dispose: () => {
        this.groups.delete(id);
      },
    });

    group.forEach((item, i) => {
      const actionId = id + '-action-' + i;
      if (item.type === 'action') {
        disposer.addDispose(
          this.registry.registerToolbarAction({
            id: actionId,
            description: item.description || actionId,
            component: createToolbarActionBtn({
              iconClass: item.iconClass!,
              title: item.title,
              id: actionId,
              delegate: (delegate) => {
                if (delegate) {
                  delegate.onClick(item.click);
                }
              },
            }),
            preferredPosition: {
              group: id,
            },
          }),
        );
      } else if (item.type === 'enum') {
        disposer.addDispose(
          this.registry.registerToolbarAction({
            id: actionId,
            description: item.description || actionId,
            component: createToolbarActionSelect({
              defaultValue: item.defaultValue || item.title,
              options: item.enum.map((e) => ({
                label: e,
                value: e,
              })),
              onSelect: (value) => item.select(value),
            }),
            preferredPosition: {
              group: id,
            },
          }),
        );
      }
    });

    this.groups.set(id, disposer);

    return disposer;
  }

  public unRegistryActionGroup(id: string) {
    if (this.groups.has(id)) {
      this.groups.get(id)!.dispose;
    }
  }
}
