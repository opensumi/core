import { Autowired, Injectable } from '@opensumi/di';
import { IDisposable, Event, Emitter, IContextKeyService, toDisposable } from '@opensumi/ide-core-browser';
import { SetMap } from '@opensumi/ide-core-common/lib/map';

import { IViewContentDescriptor } from '..';
import { IViewsRegistry } from '../common';

export enum ViewContentGroups {
  Open = '2_open',
  Debug = '4_debug',
  SCM = '5_scm',
  More = '9_more',
}

interface IItem {
  readonly descriptor: IViewContentDescriptor;
  visible: boolean;
}

function compareViewContentDescriptors(a: IViewContentDescriptor, b: IViewContentDescriptor): number {
  const aGroup = a.group ?? ViewContentGroups.More;
  const bGroup = b.group ?? ViewContentGroups.More;
  if (aGroup !== bGroup) {
    return aGroup.localeCompare(bGroup);
  }
  return (a.order ?? 5) - (b.order ?? 5);
}

@Injectable({ multiple: true })
export class ViewsController {
  private _onDidChange = new Emitter<void>();
  readonly onDidChange = this._onDidChange.event;

  private defaultItem: IItem | undefined;
  private items: IItem[] = [];

  get contents(): IViewContentDescriptor[] {
    const visibleItems = this.items.filter((v) => v.visible);

    if (visibleItems.length === 0 && this.defaultItem) {
      return [this.defaultItem.descriptor];
    }

    return visibleItems.map((v) => v.descriptor);
  }

  @Autowired(IContextKeyService)
  contextKeyService: IContextKeyService;

  @Autowired(IViewsRegistry)
  viewsRegistry: IViewsRegistry;

  private disposables: IDisposable[] = [];

  constructor(private id: string) {
    this.contextKeyService.onDidChangeContext(this.onDidChangeContext, this, this.disposables);
    Event.filter(this.viewsRegistry.onDidChangeViewWelcomeContent, (id) => id === this.id)(
      this.onDidChangeViewWelcomeContent,
      this,
      this.disposables,
    );
    this.onDidChangeViewWelcomeContent();
  }

  private onDidChangeViewWelcomeContent(): void {
    const descriptors = this.viewsRegistry.getViewWelcomeContent(this.id);

    this.items = [];

    for (const descriptor of descriptors) {
      if (descriptor.when === 'default') {
        this.defaultItem = { descriptor, visible: true };
      } else {
        const visible = descriptor.when ? this.contextKeyService.match(descriptor.when) : true;
        this.items.push({ descriptor, visible });
      }
    }

    this._onDidChange.fire();
  }

  private onDidChangeContext(): void {
    let didChange = false;

    for (const item of this.items) {
      if (!item.descriptor.when || item.descriptor.when === 'default') {
        continue;
      }

      const visible = this.contextKeyService.match(item.descriptor.when);

      if (item.visible === visible) {
        continue;
      }

      item.visible = visible;
      didChange = true;
    }

    if (didChange) {
      this._onDidChange.fire();
    }
  }

  dispose(): void {
    this.disposables.forEach((item) => item.dispose());
    this.disposables = [];
  }
}

@Injectable()
export class ViewsRegistry implements IViewsRegistry {
  private viewWelcomeContent = new SetMap<string, IViewContentDescriptor>();

  private readonly _onDidChangeViewWelcomeContent = new Emitter<string>();
  readonly onDidChangeViewWelcomeContent = this._onDidChangeViewWelcomeContent.event;

  registerViewWelcomeContent(id: string, descriptor: IViewContentDescriptor): IDisposable {
    this.viewWelcomeContent.add(id, descriptor);
    this._onDidChangeViewWelcomeContent.fire(id);
    return {
      dispose: () => {
        this.viewWelcomeContent.delete(id, descriptor);
        this._onDidChangeViewWelcomeContent.fire(id);
      },
    };
  }

  registerViewWelcomeContent2<TKey>(
    id: string,
    viewContentMap: Map<TKey, IViewContentDescriptor>,
  ): Map<TKey, IDisposable> {
    const disposables = new Map<TKey, IDisposable>();

    for (const [key, content] of viewContentMap) {
      this.viewWelcomeContent.add(id, content);

      disposables.set(
        key,
        toDisposable(() => {
          this.viewWelcomeContent.delete(id, content);
          this._onDidChangeViewWelcomeContent.fire(id);
        }),
      );
    }
    this._onDidChangeViewWelcomeContent.fire(id);

    return disposables;
  }

  getViewWelcomeContent(id: string) {
    const result: IViewContentDescriptor[] = [];
    this.viewWelcomeContent.forEach(id, (descriptor) => result.push(descriptor));
    result.sort(compareViewContentDescriptors);
    return result;
  }
}
