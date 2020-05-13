import { IToolbarActionBtnStyle, IToolbarSelectStyle } from '@ali/ide-core-browser';

export interface IToolbarActionBasicContribution {
  id: string;
  preferredPosition?: {
    location?: string,
    group?: string,
  };
  strictPosition?: {
    location: string,
    group: string,
  };
}

export interface IToolbarButtonContribution extends  IToolbarActionBasicContribution {
  type: 'button';
  command?: string;
  title: string;
  iconPath: string;
  iconMaskMode?: boolean;
  states?: {
    [key: string]: {
      title?: string,
      iconPath?: string,
      iconMaskMode?: boolean ;
    } & IToolbarActionBtnStyle,
  };
  defaultState?: string;
}

export interface IToolbarSelectContribution<T = any> extends IToolbarActionBasicContribution {
  type: 'select';
  command?: string;
  options: {
    iconPath?: string,
    iconMaskMode?: boolean;
    label?: string,
    value: T
  }[];
  defaultValue: T;
  optionEqualityKey?: string;
  states?: {
    [key: string]: IToolbarSelectStyle,
  };
  defaultState?: string;
}
