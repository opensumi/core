import { Injectable, Autowired } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { Emitter, Event } from '@opensumi/ide-core-common';

import {
  ITerminalPreference,
  IPreferenceValue,
  DefaultOptions,
  OptionTypeName,
  DefaultOptionValue,
  CodeTerminalSettingId,
  CodeCompatibleOption,
} from '../common/preference';

@Injectable()
export class TerminalPreference implements ITerminalPreference {
  static defaultOptions: DefaultOptions = {
    allowTransparency: true,
    macOptionIsMeta: false,
    cursorBlink: false,
    scrollback: 2500,
    tabStopWidth: 8,
    fontSize: 12,
    copyOnSelection: false,
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
    switch (option) {
      case OptionTypeName.fontSize:
        return value > 5 ? value : 5;
      default:
        return value || DefaultOptionValue[option];
    }
  }

  constructor() {
    this.service.onPreferenceChanged(({ preferenceName, newValue, oldValue }) => {
      const name = this._prefToOption(preferenceName);
      if (newValue === oldValue) {
        return;
      }
      if (OptionTypeName[name] || CodeCompatibleOption.has(name)) {
        this._onChange.fire({
          name,
          value: this._valid(name, newValue),
        });
      }
    });
  }

  getCodeCompatibleOption(): Partial<DefaultOptions> {
    return {
      copyOnSelection: this.service.get(CodeTerminalSettingId.CopyOnSelection, false),
      cursorBlink: this.service.get(
        CodeTerminalSettingId.CursorBlinking,
        TerminalPreference.defaultOptions.cursorBlink,
      ),
      fontSize: this.service.get(CodeTerminalSettingId.FontSize, TerminalPreference.defaultOptions.fontSize),
      scrollback: this.service.get(CodeTerminalSettingId.Scrollback, TerminalPreference.defaultOptions.scrollback),
    };
  }

  /**
   * @param option 终端的 option 选项名
   */
  get<T = any>(option: string): T {
    const val = this.service.get<T>(this._optionToPref(option), DefaultOptionValue[option]);
    return this._valid(option, val);
  }

  toJSON() {
    const options = {};

    Object.entries(OptionTypeName).forEach(([name]) => {
      if (!name) {
        return;
      }
      const val = this.get(name);
      if (val) {
        options[name] = val;
      }
    });

    // Code 兼容设置项优先级低于 Sumi 设置项
    return {
      ...TerminalPreference.defaultOptions,
      ...this.getCodeCompatibleOption(),
      ...options,
    };
  }
}
