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
  static defaultOptions: SupportedOptions = {
    allowTransparency: true,
    macOptionIsMeta: false,
    cursorBlink: false,
    scrollback: 2500,
    tabStopWidth: 8,
    fontSize: 12,
    copyOnSelection: false,
    fontFamily: "Menlo, Monaco, 'Courier New', monospace",
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
      case SupportedOptionsName.fontSize:
        return value > 5 ? value : 5;
      default:
        return value || TerminalPreference.defaultOptions[option];
    }
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

  getCodeCompatibleOption(): Partial<SupportedOptions> {
    return {
      copyOnSelection: this.service.get(CodeTerminalSettingId.CopyOnSelection, false),
      cursorBlink: this.service.get(
        CodeTerminalSettingId.CursorBlinking,
        TerminalPreference.defaultOptions.cursorBlink,
      ),
      fontSize: this.service.get(CodeTerminalSettingId.FontSize, TerminalPreference.defaultOptions.fontSize),
      scrollback: this.service.get(CodeTerminalSettingId.Scrollback, TerminalPreference.defaultOptions.scrollback),
      fontFamily:
        this.service.get(CodeTerminalSettingId.FontFamily) ||
        this.service.get('editor.fontFamily') ||
        TerminalPreference.defaultOptions.fontFamily,
    };
  }

  /**
   * @param option 终端的 option 选项名
   */
  get<T = any>(option: string): T {
    const val = this.service.get<T>(this._optionToPref(option), TerminalPreference.defaultOptions[option]);
    return this._valid(option, val);
  }

  /**
   * 遍历所有支持项，用户没有设置该项则返回默认值
   */
  getOptions() {
    const options = {};

    Object.entries(SupportedOptionsName).forEach(([name]) => {
      if (!name) {
        return;
      }
      const val = this.get(name);
      if (val) {
        options[name] = val;
      }
    });
    return options;
  }

  toJSON() {
    return {
      ...TerminalPreference.defaultOptions,
      ...this.getOptions(),
      // 获取 Code 兼容的设置项的函数要放最后以覆盖默认值
      ...this.getCodeCompatibleOption(),
    };
  }
}
