import type { DropDownProps } from '@opensumi/ide-components';
import { IToolbarActionBtnStyle, IToolbarSelectStyle, IToolbarPopoverStyle } from '@opensumi/ide-core-browser';

export interface IToolbarActionBasicContribution {
  id: string;
  weight?: number;
  preferredPosition?: {
    location?: string;
    group?: string;
  };
  strictPosition?: {
    location: string;
    group: string;
  };
  description: string;
}

export interface IToolbarButtonContribution extends IToolbarActionBasicContribution {
  type: 'button';
  command?: string;
  title: string;
  iconPath: string;
  iconMaskMode?: boolean;
  states?: {
    [key: string]: {
      title?: string;
      iconPath?: string;
      iconMaskMode?: boolean;
    } & IToolbarActionBtnStyle;
  };
  defaultState?: string;
  // popover 元素的 component id
  popoverComponent?: string;

  popoverStyle?: IToolbarPopoverStyle;
  when?: string;
}

export interface IToolbarSelectContribution<T = any> extends IToolbarActionBasicContribution {
  type: 'select';
  command?: string;
  options: {
    iconPath?: string;
    iconMaskMode?: boolean;
    label?: string;
    value: T;
  }[];
  defaultValue: T;
  optionEqualityKey?: string;
  states?: {
    [key: string]: IToolbarSelectStyle;
  };
  defaultState?: string;
}

export interface IToolbarDropdownButtonContribution<T = any> extends IToolbarActionBasicContribution {
  type: 'dropdownButton';
  command?: string;
  trigger?: DropDownProps['trigger'];
  options: {
    label?: string;
    value: T;
  }[];
}
