import { IFileTreeItem, IFileTreeAPI } from '../common';
import { URI, uuid } from '@ali/ide-core-browser';
import { FileStat } from '@ali/ide-file-service';
import { observable } from 'mobx';

export class AbstractFileTreeItem implements IFileTreeItem {
  public readonly id = uuid();

  public selected: boolean = false;
  public focused: boolean = false;

  constructor(
    protected readonly fileApi: IFileTreeAPI,
    public readonly uri: URI,
    public readonly name: string,
    public filestat: FileStat = { children: [], isDirectory: false, uri: '', lastModification: 0 },
    public readonly tooltip: string,
    public readonly icon: string,
    public readonly parent: Directory | undefined,
    public readonly priority = 1,
    public isTemporary = false,
  ) {
  }

  updateFileStat(key: any, value: any) {
    this.filestat[key] = value;
    return this;
  }

  updateTemporary(value: boolean) {
    this.isTemporary = value;
    return this;
  }
}

export class Directory extends AbstractFileTreeItem {
  @observable.shallow public children: (Directory | File)[] = [];
  public expanded: boolean = false;

  constructor(
    fileApi: IFileTreeAPI,
    uri = new URI(''),
    name = '',
    filestat: FileStat = { children: [], isDirectory: true, uri: '', lastModification: 0 },
    tooltip = '',
    icon = '',
    parent: Directory | undefined,
    priority,
    isTemporary?: boolean,
  ) {
    super(fileApi, uri, name, filestat, tooltip, icon, parent, priority, isTemporary);
    this.init();
  }

  init() {
    // 当该节点无父节点时为Root节点，默认展开
    if (!this.parent) {
      this.expanded = true;
    }
    this.initChidren();
  }

  initChidren() {
    const children: (Directory | File)[] = [];
    if (this.filestat.isDirectory) {
      if (this.filestat.children && this.filestat.children.length > 0) {
        const childrenFileStat = this.filestat.children.filter((stat) => !!stat);
        for (const child of childrenFileStat) {
          const item = this.fileApi.fileStat2FileTreeItem(child, this, this.filestat.isSymbolicLink);
          children.push(item);
        }
      }
    }
    this.children = this.fileApi.sortByNumberic(children);
  }

  async getChildren() {
    try {
      const file = await this.fileApi.getFiles(this.filestat, this);
      if (file) {
        const parent = file[0] as Directory;
        this.children = parent ? parent.children : [];
      } else {
        this.children = [];
      }
    } catch (e) {
      this.children = [];
    }
  }

  hasChildren(uri: string | URI) {
    for (let i = this.children.length - 1; i >= 0; i--) {
      if (typeof uri === 'string') {
        if (this.children[i].uri.toString() === uri) {
          return true;
        }
      } else {
        if (this.children[i].uri.isEqual(uri)) {
          return true;
        }
      }
    }
    return false;
  }

  addChildren(item: Directory | File) {
    for (const child of this.children) {
      if (child.uri.isEqual(item.uri)) {
        return;
      }
    }
    this.children = this.fileApi.sortByNumberic(this.children.concat(item));
  }

  removeChildren(uri: string | URI) {
    for (let i = this.children.length - 1; i >= 0; i--) {
      if (typeof uri === 'string') {
        if (this.children[i].uri.toString() === uri) {
          return this.children.splice(i, 1);
        }
      } else {
        if (this.children[i].uri.isEqual(uri)) {
          return this.children.splice(i, 1);
        }
      }
    }
    return false;
  }

  replaceChildren(item: Directory | File) {
    for (let i = this.children.length - 1; i >= 0; i--) {
      if (this.children[i].uri.isEqual(item.uri)) {
        this.children.splice(i, 1, item);
        break;
      }
    }
  }

  updateChildren(items: (Directory | File)[]) {
    this.children = items;
  }
}

export class File extends AbstractFileTreeItem {

  constructor(
    fileApi: IFileTreeAPI,
    uri = new URI(''),
    name = '',
    filestat: FileStat = { children: [], isDirectory: true, uri: '', lastModification: 0 },
    tooltip = '',
    icon = '',
    parent,
    priority,
    isTemporary?: boolean,
  ) {
    super(fileApi, uri, name, filestat, tooltip, icon, parent, priority, isTemporary);
  }
}

export namespace Directory {
  export const isDirectory = (file: (Directory | File)) => {
    if ('expanded' in file && 'children' in file) {
      return true;
    }
    return false;
  };
}
