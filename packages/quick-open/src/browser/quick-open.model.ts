import { URI } from '@ali/ide-core-common';
import { Keybinding } from '@ali/ide-core-browser';

export interface Highlight {
  start: number;
  end: number;
}

export enum QuickOpenMode {
  PREVIEW,
  OPEN,
  OPEN_IN_BACKGROUND,
}

export interface QuickOpenItemOptions {
  tooltip?: string;
  label?: string;
  labelHighlights?: Highlight[];
  description?: string;
  descriptionHighlights?: Highlight[];
  detail?: string;
  detailHighlights?: Highlight[];
  hidden?: boolean;
  uri?: URI;
  iconClass?: string;
  keybinding?: Keybinding;
  run?(mode: QuickOpenMode): boolean;
}
export interface QuickOpenGroupItemOptions extends QuickOpenItemOptions {
  groupLabel?: string;
  showBorder?: boolean;
}

export class QuickOpenItem<T extends QuickOpenItemOptions = QuickOpenItemOptions> {

  constructor(
    protected options: T = {} as T,
  ) { }

  getTooltip(): string | undefined {
    return this.options.tooltip || this.getLabel();
  }
  getLabel(): string | undefined {
    return this.options.label;
  }
  getLabelHighlights(): Highlight[] {
    return this.options.labelHighlights || [];
  }
  getDescription(): string | undefined {
    return this.options.description;
  }
  getDescriptionHighlights(): Highlight[] | undefined {
    return this.options.descriptionHighlights;
  }
  getDetail(): string | undefined {
    return this.options.detail;
  }
  getDetailHighlights(): Highlight[] | undefined {
    return this.options.detailHighlights;
  }
  isHidden(): boolean {
    return this.options.hidden || false;
  }
  getUri(): URI | undefined {
    return this.options.uri;
  }
  getIconClass(): string | undefined {
    return this.options.iconClass;
  }
  getKeybinding(): Keybinding | undefined {
    return this.options.keybinding;
  }
  run(mode: QuickOpenMode): boolean {
    if (!this.options.run) {
      return false;
    }
    return this.options.run(mode);
  }
}

export class QuickOpenGroupItem<T extends QuickOpenGroupItemOptions = QuickOpenGroupItemOptions> extends QuickOpenItem<T> {

  getGroupLabel(): string | undefined {
    return this.options.groupLabel;
  }
  showBorder(): boolean {
    return this.options.showBorder || false;
  }
}

export interface QuickOpenModel {
  getItems(lookFor: string): QuickOpenItem[];
}

export const QuickOpenService = Symbol('QuickOpenService');

export interface QuickOpenService {
  open(model: QuickOpenModel, options?: QuickOpenOptions): void;
}

export type QuickOpenOptions = Partial<QuickOpenOptions.Resolved>;
export namespace QuickOpenOptions {
  export interface Resolved {
    readonly prefix: string;
    readonly placeholder: string;
    onClose(canceled: boolean): void;

    readonly fuzzyMatchLabel: boolean;
    readonly fuzzyMatchDetail: boolean;
    readonly fuzzyMatchDescription: boolean;
    readonly fuzzySort: boolean;
    readonly skipPrefix: number;
  }
  export const defaultOptions: Resolved = Object.freeze({
    prefix: '',
    placeholder: '',
    onClose: () => { /* no-op*/ },
    fuzzyMatchLabel: false,
    fuzzyMatchDetail: false,
    fuzzyMatchDescription: false,
    fuzzySort: false,
    skipPrefix: 0,
  });
  export function resolve(options: QuickOpenOptions = {}, source: Resolved = defaultOptions): Resolved {
    return Object.assign({}, source, options);
  }
}

export interface QuickPickItem<T> {
  label: string;
  value: T;
  description?: string;
  detail?: string;
  iconClass?: string;
}

export interface QuickPickOptions {
  placeholder?: string;
  fuzzyMatchLabel?: boolean;
  fuzzyMatchDescription?: boolean;
}

export const QuickPickService = Symbol('QuickPickService');

export interface QuickPickService {
  show(elements: string[], options?: QuickPickOptions): Promise<string | undefined>;
  show<T>(elements: QuickPickItem<T>[], options?: QuickPickOptions): Promise<T | undefined>;
}

export const PrefixQuickOpenService = Symbol('PrefixQuickOpenService');
export interface PrefixQuickOpenService {
  open(prefix: string): void;
}
