import pickBy from 'lodash/pickBy';
import { ITerminalOptions } from 'xterm';

import { Injectable, Autowired } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { Emitter, Event } from '@opensumi/ide-core-common';

import {
  ITerminalPreference,
  IPreferenceValue,
  SupportedOptions,
  SupportedOptionsName,
  CodeTerminalSettingId,
} from '../common/preference';

@Injectable()
export class TerminalPreference implements ITerminalPreference {
  static defaultOptions: SupportedOptions & ITerminalOptions = {
    allowTransparency: true,
    macOptionIsMeta: false,
    cursorBlink: false,
    scrollback: 2500,
    tabStopWidth: 8,
    fontSize: 12,
    copyOnSelection: false,
    fontFamily: "Menlo, Monaco, 'Courier New', monospace",
    cursorStyle: 'block',
  };

  private _onChange = new Emitter<IPreferenceValue>();
  onChange: Event<IPreferenceValue> = this._onChange.event;

  @Autowired(PreferenceService)
  service: PreferenceService;

  protected _prefToOption(pref: string): string {
    if (pref.startsWith('terminal.integrated.')) {
      return pref.replace('terminal.integrated.', '');
    } else {
      return pref.replace('terminal.', '');
    }
  }

  protected _optionToPref(option: string): string {
    return `terminal.${option}`;
  }

  protected _valid(option: string, value: any): any {
    return this.toValidOption(option, value) || TerminalPreference.defaultOptions[option];
  }

  constructor() {
    this.service.onPreferenceChanged(({ preferenceName, newValue, oldValue }) => {
      const name = this._prefToOption(preferenceName);
      if (newValue === oldValue) {
        return;
      }
      if (SupportedOptionsName[name]) {
        this._onChange.fire({
          name,
          value: this._valid(name, newValue),
        });
      }
    });
  }

  getCodeCompatibleOption(): Partial<SupportedOptions & ITerminalOptions> {
    const options = {
      copyOnSelection: this.service.get(CodeTerminalSettingId.CopyOnSelection),
      cursorBlink: this.service.get(CodeTerminalSettingId.CursorBlinking),
      fontSize: this.service.get(CodeTerminalSettingId.FontSize),
      scrollback: this.service.get(CodeTerminalSettingId.Scrollback),
      fontFamily: this.service.get(CodeTerminalSettingId.FontFamily) || this.service.get('editor.fontFamily'),
      fontWeight: this.service.get(CodeTerminalSettingId.FontWeight),
      fontWeightBold: this.service.get(CodeTerminalSettingId.FontWeightBold),
      cursorStyle:
        this.service.get(CodeTerminalSettingId.CursorStyle) === 'line'
          ? 'bar'
          : this.service.get(CodeTerminalSettingId.CursorStyle),
      cursorWidth: this.service.get(CodeTerminalSettingId.CursorWidth),
      lineHeight: this.service.get(CodeTerminalSettingId.LineHeight),
      letterSpacing: this.service.get(CodeTerminalSettingId.LetterSpacing),
      fastScrollSensitivity: this.service.get(CodeTerminalSettingId.FastScrollSensitivity),
    };
    return pickBy(options, (val) => val !== undefined);
  }

  /**
   * @param option 终端的 option 选项名
   */
  get<T = any>(option: string): T {
    const val = this.service.get<T>(this._optionToPref(option), TerminalPreference.defaultOptions[option]);
    return this._valid(option, val);
  }

  /**
   * @param option 终端的 option 选项名
   */
  getOrUndefined<T = any>(option: string): T | undefined {
    const val = this.service.get<T>(this._optionToPref(option));
    return val;
  }

  toValidOption(option: string, value: any) {
    switch (option) {
      case SupportedOptionsName.fontSize:
        return value > 5 ? value : 5;
      case SupportedOptionsName.cursorStyle:
        return value === 'line' ? 'bar' : value;
      default:
        return value;
    }
  }

  /**
   * 遍历所有支持项，用户没有设置该项则返回空
   */
  getOptions() {
    const options = {};

    Object.entries(SupportedOptionsName).forEach(([name]) => {
      if (!name) {
        return;
      }
      const val = this.getOrUndefined(name);
      if (val) {
        options[name] = val;
      }
    });
    return options;
  }

  toJSON(): SupportedOptions & ITerminalOptions {
    return {
      ...TerminalPreference.defaultOptions,
      ...this.getCodeCompatibleOption(),
      ...this.getOptions(),
    };
  }
}
