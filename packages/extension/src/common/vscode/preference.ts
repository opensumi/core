import { ConfigurationTarget } from './ext-types';

export interface PreferenceChangeExt {
  preferenceName: string;
  newValue: any;
}

export interface PreferenceData {
  [scope: number]: any;
}

export interface IExtHostPreference {
  $acceptConfigurationChanged(data: { [key: string]: any }, eventData: PreferenceChangeExt[]): void;
  $initializeConfiguration(data: any): void;
}

export interface IMainThreadPreference {
  $updateConfigurationOption(
      target: boolean | ConfigurationTarget | undefined,
      key: string,
      value: any,
      resource?: string,
  ): PromiseLike<void>;
  $removeConfigurationOption(
      target: boolean | ConfigurationTarget | undefined,
      key: string,
      resource?: string,
  ): PromiseLike<void>;
}
