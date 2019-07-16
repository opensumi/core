import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { IDisposable } from './disposable';
import { CommandRegistry, Command } from './command';
import { ContributionProvider } from './contribution-provider';
import { IElectronMainApi } from './electron';
import { IEventBus, BasicEvent } from './event-bus';

export interface MenuAction {
    // commandId 和 nativeRole 二选一
    commandId: string
    label?: string
    icon?: string
    order?: string
    when?: string
    nativeRole?: string
}

export namespace MenuAction {
    /* Determine whether object is a MenuAction */
    // tslint:disable-next-line:no-any
    export function is(arg: MenuAction | any): arg is MenuAction {
        return !!arg && arg === Object(arg) && 'commandId' in arg;
    }
}

export type MenuPath = string[];

export const MAIN_MENU_BAR: MenuPath = ['menubar'];

export const MenuContribution = Symbol('MenuContribution');
export interface MenuContribution {
    registerMenus(menus: MenuModelRegistry): void;
}

@Injectable()
export class MenuModelRegistry {
    protected readonly root = new CompositeMenuNode('');


    @Autowired(CommandRegistry)
    protected readonly commands: CommandRegistry;

    @Autowired(INJECTOR_TOKEN)
    private injector: Injector;

    private _eventBus: IEventBus;

    @Autowired(MenuContribution)
    protected readonly contributions: ContributionProvider<MenuContribution>;

    onStart(): void {
        for (const contrib of this.contributions.getContributions()) {
            contrib.registerMenus(this);
        }
    }

    get eventBus(): IEventBus {
        if (!this._eventBus) {
            this._eventBus = this.injector.get(IEventBus);
        }
        return this._eventBus;
    }

    registerMenuAction(menuPath: MenuPath, item: MenuAction): IDisposable {
        const parent = this.findGroup(menuPath);
        const actionNode = new ActionMenuNode(item, this.commands);
        const disposer = parent.addNode(actionNode);
        this.eventBus.fire(new MenuUpdateEvent(menuPath))
        return disposer;
    }

    registerSubmenu(menuPath: MenuPath, label: string): IDisposable {
        if (menuPath.length === 0) {
            throw new Error('The sub menu path cannot be empty.');
        }
        const index = menuPath.length - 1;
        const menuId = menuPath[index];
        const groupPath = index === 0 ? [] : menuPath.slice(0, index);
        const parent = this.findGroup(groupPath);
        let groupNode = this.findSubMenu(parent, menuId);
        if (!groupNode) {
            groupNode = new CompositeMenuNode(menuId, label);
            const disposer = parent.addNode(groupNode);
            this.eventBus.fire(new MenuUpdateEvent(menuPath))
            return disposer;
        } else {
            if (!groupNode.label) {
                groupNode.label = label;
                this.eventBus.fire(new MenuUpdateEvent(menuPath))
            } else if (groupNode.label !== label) {
                throw new Error("The group '" + menuPath.join('/') + "' already has a different label.");
            }
            return { dispose: () => { } };
        }
    }

    /**
     * Unregister menu item from the registry
     *
     * @param item
     */
    unregisterMenuAction(item: MenuAction, menuPath?: MenuPath): void;
    /**
     * Unregister menu item from the registry
     *
     * @param command
     */
    unregisterMenuAction(command: Command, menuPath?: MenuPath): void;
    /**
     * Unregister menu item from the registry
     *
     * @param id
     */
    unregisterMenuAction(id: string, menuPath?: MenuPath): void;
    unregisterMenuAction(itemOrCommandOrId: MenuAction | Command | string, menuPath?: MenuPath): void {
        const id = MenuAction.is(itemOrCommandOrId) ? ( itemOrCommandOrId.commandId || 'native-' + itemOrCommandOrId.nativeRole)
            : Command.is(itemOrCommandOrId) ? itemOrCommandOrId.id
                : itemOrCommandOrId;

        if (menuPath) {
            const parent = this.findGroup(menuPath);
            return parent.removeNode(id);
        }

        // Recurse all menus, removing any menus matching the id
        const recurse = (root: CompositeMenuNode) => {
            root.children.forEach(node => {
                if (node instanceof CompositeMenuNode) {
                    node.removeNode(id);
                    recurse(node);
                }
            });
        };
        recurse(this.root);
    }

    protected findGroup(menuPath: MenuPath): CompositeMenuNode {
        let currentMenu = this.root;
        for (const segment of menuPath) {
            currentMenu = this.findSubMenu(currentMenu, segment);
        }
        return currentMenu;
    }

    protected findSubMenu(current: CompositeMenuNode, menuId: string): CompositeMenuNode {
        const sub = current.children.find(e => e.id === menuId);
        if (sub instanceof CompositeMenuNode) {
            return sub;
        }
        if (sub) {
            throw new Error(`'${menuId}' is not a menu group.`);
        }
        const newSub = new CompositeMenuNode(menuId);
        current.addNode(newSub);
        return newSub;
    }

    getMenu(menuPath: MenuPath = []): CompositeMenuNode {
        return this.findGroup(menuPath);
    }
}

export interface MenuNode {
    readonly label?: string
    /**
     * technical identifier
     */
    readonly id: string

    readonly sortString: string
}

export class CompositeMenuNode implements MenuNode {
    protected readonly _children: MenuNode[] = [];
    constructor(
        public readonly id: string,
        public label?: string
    ) { }

    get children(): ReadonlyArray<MenuNode> {
        return this._children;
    }

    public addNode(node: MenuNode): IDisposable {
        this._children.push(node);
        this._children.sort((m1, m2) => {
            // The navigation group is special as it will always be sorted to the top/beginning of a menu.
            if (CompositeMenuNode.isNavigationGroup(m1)) {
                return -1;
            }
            if (CompositeMenuNode.isNavigationGroup(m2)) {
                return 1;
            }
            if (m1.sortString < m2.sortString) {
                return -1;
            } else if (m1.sortString > m2.sortString) {
                return 1;
            } else {
                return 0;
            }
        });
        return {
            dispose: () => {
                const idx = this._children.indexOf(node);
                if (idx >= 0) {
                    this._children.splice(idx, 1);
                }
            }
        };
    }

    public removeNode(id: string) {
        const node = this._children.find(n => n.id === id);
        if (node) {
            const idx = this._children.indexOf(node);
            if (idx >= 0) {
                this._children.splice(idx, 1);
            }
        }
    }

    get sortString() {
        return this.id;
    }

    get isSubmenu(): boolean {
        return this.label !== undefined;
    }

    static isNavigationGroup(node: MenuNode): node is CompositeMenuNode {
        return node instanceof CompositeMenuNode && node.id === 'navigation';
    }
}

export class ActionMenuNode implements MenuNode {
    constructor(
        public readonly action: MenuAction,
        protected readonly commands: CommandRegistry
    ) { }

    get id(): string {
        return this.action.commandId || 'native-' + this.action.nativeRole;
    }

    get label(): string | undefined {
        if (this.action.label) {
            return this.action.label;
        }
        if (this.action.nativeRole) {
            return undefined;
        }
        const cmd = this.commands.getCommand(this.action.commandId!);
        if (!cmd) {
            throw new Error(`A command with id '${this.action.commandId}' does not exist.`);
        }
        return cmd.label || cmd.id;
    }

    get icon(): string | undefined {
        if (this.action.icon) {
            return this.action.icon;
        }
        if (this.action.nativeRole) {
            return '';
        }
        const command = this.commands.getCommand(this.action.commandId!);
        return command && command.iconClass;
    }

    get sortString() {
        return this.action.order || this.label || '';
    }

    get nativeRole() {
        return this.action.nativeRole
    }
}


export interface INativeMenuTemplate {

    id?: string;

    label?: string;

    type?: 'separator';

    submenu?: INativeMenuTemplate[];

    accelerator?: string;
    
    disabled?: boolean;

    selected?: boolean;

    action?: boolean;

    role?: string;

}


export interface IElectronMainMenuService extends IElectronMainApi<'menuClick' | 'menuClose'> {

    showContextMenu(template: INativeMenuTemplate, webContentsId: number): Promise<void>;

    setApplicationMenu(template: INativeMenuTemplate, windowId: number): Promise<void>;

    on(event: 'menuClick', listener: (targetId: string, menuId: string) => void) : IDisposable;

    on(event: 'menuClose', listener: (targetId: string, contextMenuId: string) => void) : IDisposable;

}

export const IElectronMainMenuService = Symbol('IElectronMainMenuService');

export class MenuUpdateEvent extends BasicEvent<MenuPath> {};