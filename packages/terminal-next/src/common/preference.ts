import { Event } from '@opensumi/ide-core-common';

export interface IPreferenceValue {
  name: string;
  value: string | number | boolean;
}

export const ITerminalPreference = Symbol('ITerminalPreference');
export interface ITerminalPreference {
  get<T = any>(key: string): T;
  onChange: Event<IPreferenceValue>;
  toJSON(): any;
}

export interface DefaultOptions {
  allowTransparency: boolean;
  macOptionIsMeta: false;
  cursorBlink: false;
  scrollback: number;
  tabStopWidth: number;
  fontSize: number;
}

export const OptionTypeName = {
  type: 'type',
  fontFamily: 'fontFamily',
  fontSize: 'fontSize',
  fontWeight: 'fontWeight',
  lineHeight: 'lineHeight',
  cursorBlink: 'cursorBlink',
  scrollback: 'scrollback',
};

export const DefaultOptionValue = {
  fontFamily: 'courier-new, courier, monospace',
  fontSize: 12,
};

export const enum CodeTerminalSettingPrefix {
  Shell = 'terminal.integrated.shell.',
  ShellArgs = 'terminal.integrated.shellArgs.',
  DefaultProfile = 'terminal.integrated.defaultProfile.',
  Profiles = 'terminal.integrated.profiles.',
}

export const enum CodeTerminalSettingId {
  ShellLinux = 'terminal.integrated.shell.linux',
  ShellMacOs = 'terminal.integrated.shell.osx',
  ShellWindows = 'terminal.integrated.shell.windows',
  SendKeybindingsToShell = 'terminal.integrated.sendKeybindingsToShell',
  AutomationShellLinux = 'terminal.integrated.automationShell.linux',
  AutomationShellMacOs = 'terminal.integrated.automationShell.osx',
  AutomationShellWindows = 'terminal.integrated.automationShell.windows',
  AutomationProfileLinux = 'terminal.integrated.automationProfile.linux',
  AutomationProfileMacOs = 'terminal.integrated.automationProfile.osx',
  AutomationProfileWindows = 'terminal.integrated.automationProfile.windows',
  ShellArgsLinux = 'terminal.integrated.shellArgs.linux',
  ShellArgsMacOs = 'terminal.integrated.shellArgs.osx',
  ShellArgsWindows = 'terminal.integrated.shellArgs.windows',
  ProfilesWindows = 'terminal.integrated.profiles.windows',
  ProfilesMacOs = 'terminal.integrated.profiles.osx',
  ProfilesLinux = 'terminal.integrated.profiles.linux',
  DefaultProfileLinux = 'terminal.integrated.defaultProfile.linux',
  DefaultProfileMacOs = 'terminal.integrated.defaultProfile.osx',
  DefaultProfileWindows = 'terminal.integrated.defaultProfile.windows',
  UseWslProfiles = 'terminal.integrated.useWslProfiles',
  TabsEnabled = 'terminal.integrated.tabs.enabled',
  TabsEnableAnimation = 'terminal.integrated.tabs.enableAnimation',
  TabsHideCondition = 'terminal.integrated.tabs.hideCondition',
  TabsShowActiveTerminal = 'terminal.integrated.tabs.showActiveTerminal',
  TabsShowActions = 'terminal.integrated.tabs.showActions',
  TabsLocation = 'terminal.integrated.tabs.location',
  TabsFocusMode = 'terminal.integrated.tabs.focusMode',
  MacOptionIsMeta = 'terminal.integrated.macOptionIsMeta',
  MacOptionClickForcesSelection = 'terminal.integrated.macOptionClickForcesSelection',
  AltClickMovesCursor = 'terminal.integrated.altClickMovesCursor',
  CopyOnSelection = 'terminal.integrated.copyOnSelection',
  DrawBoldTextInBrightColors = 'terminal.integrated.drawBoldTextInBrightColors',
  FontFamily = 'terminal.integrated.fontFamily',
  FontSize = 'terminal.integrated.fontSize',
  LetterSpacing = 'terminal.integrated.letterSpacing',
  LineHeight = 'terminal.integrated.lineHeight',
  MinimumContrastRatio = 'terminal.integrated.minimumContrastRatio',
  FastScrollSensitivity = 'terminal.integrated.fastScrollSensitivity',
  MouseWheelScrollSensitivity = 'terminal.integrated.mouseWheelScrollSensitivity',
  BellDuration = 'terminal.integrated.bellDuration',
  FontWeight = 'terminal.integrated.fontWeight',
  FontWeightBold = 'terminal.integrated.fontWeightBold',
  CursorBlinking = 'terminal.integrated.cursorBlinking',
  CursorStyle = 'terminal.integrated.cursorStyle',
  CursorWidth = 'terminal.integrated.cursorWidth',
  Scrollback = 'terminal.integrated.scrollback',
  DetectLocale = 'terminal.integrated.detectLocale',
  DefaultLocation = 'terminal.integrated.defaultLocation',
  GpuAcceleration = 'terminal.integrated.gpuAcceleration',
  TerminalTitleSeparator = 'terminal.integrated.tabs.separator',
  TerminalTitle = 'terminal.integrated.tabs.title',
  TerminalDescription = 'terminal.integrated.tabs.description',
  RightClickBehavior = 'terminal.integrated.rightClickBehavior',
  Cwd = 'terminal.integrated.cwd',
  ConfirmOnExit = 'terminal.integrated.confirmOnExit',
  ConfirmOnKill = 'terminal.integrated.confirmOnKill',
  EnableBell = 'terminal.integrated.enableBell',
  CommandsToSkipShell = 'terminal.integrated.commandsToSkipShell',
  AllowChords = 'terminal.integrated.allowChords',
  AllowMnemonics = 'terminal.integrated.allowMnemonics',
  EnvMacOs = 'terminal.integrated.env.osx',
  EnvLinux = 'terminal.integrated.env.linux',
  EnvWindows = 'terminal.integrated.env.windows',
  EnvironmentChangesIndicator = 'terminal.integrated.environmentChangesIndicator',
  EnvironmentChangesRelaunch = 'terminal.integrated.environmentChangesRelaunch',
  ShowExitAlert = 'terminal.integrated.showExitAlert',
  SplitCwd = 'terminal.integrated.splitCwd',
  WindowsEnableConpty = 'terminal.integrated.windowsEnableConpty',
  WordSeparators = 'terminal.integrated.wordSeparators',
  EnableFileLinks = 'terminal.integrated.enableFileLinks',
  UnicodeVersion = 'terminal.integrated.unicodeVersion',
  ExperimentalLinkProvider = 'terminal.integrated.experimentalLinkProvider',
  LocalEchoLatencyThreshold = 'terminal.integrated.localEchoLatencyThreshold',
  LocalEchoEnabled = 'terminal.integrated.localEchoEnabled',
  LocalEchoExcludePrograms = 'terminal.integrated.localEchoExcludePrograms',
  LocalEchoStyle = 'terminal.integrated.localEchoStyle',
  EnablePersistentSessions = 'terminal.integrated.enablePersistentSessions',
  PersistentSessionReviveProcess = 'terminal.integrated.persistentSessionReviveProcess',
  CustomGlyphs = 'terminal.integrated.customGlyphs',
  PersistentSessionScrollback = 'terminal.integrated.persistentSessionScrollback',
  InheritEnv = 'terminal.integrated.inheritEnv',
  ShowLinkHover = 'terminal.integrated.showLinkHover',
  IgnoreProcessNames = 'terminal.integrated.ignoreProcessNames',
  AutoReplies = 'terminal.integrated.autoReplies',
}

import { localize, isElectronRenderer, isWindows } from '@opensumi/ide-core-common';

import { PreferenceSchema } from '@opensumi/ide-core-common/lib/preferences';

const shellDeprecationMessageLinux = localize(
  'terminal.integrated.shell.linux.deprecation',
  'This is deprecated, the new recommended way to configure your default shell is by creating a terminal profile in {0} and setting its profile name as the default in {1}. This will currently take priority over the new profiles settings but that will change in the future.',
  '`#terminal.integrated.profiles.linux#`',
);
const shellDeprecationMessageOsx = localize(
  'terminal.integrated.shell.osx.deprecation',
  'This is deprecated, the new recommended way to configure your default shell is by creating a terminal profile in {0} and setting its profile name as the default in {1}. This will currently take priority over the new profiles settings but that will change in the future.',
  '`#terminal.integrated.profiles.osx#`',
);
const shellDeprecationMessageWindows = localize(
  'terminal.integrated.shell.windows.deprecation',
  'This is deprecated, the new recommended way to configure your default shell is by creating a terminal profile in {0} and setting its profile name as the default in {1}. This will currently take priority over the new profiles settings but that will change in the future.',
  '`#terminal.integrated.profiles.windows#`',
);

export const terminalPreferenceSchema: PreferenceSchema = {
  type: 'object',
  properties: {
    // 终端
    'terminal.type': {
      type: 'string',
      enum:
        isElectronRenderer() && isWindows
          ? ['git-bash', 'powershell', 'cmd', 'default']
          : ['zsh', 'bash', 'sh', 'default'],
      default: 'default',
      description: '%preference.terminal.typeDesc%',
    },
    'terminal.fontFamily': {
      type: 'string',
    },
    'terminal.fontSize': {
      type: 'number',
      default: 12,
    },
    'terminal.fontWeight': {
      type: 'string',
      enum: ['normal', 'bold'],
      default: 400,
    },
    'terminal.lineHeight': {
      type: 'number',
      default: 1,
    },
    'terminal.cursorBlink': {
      type: 'boolean',
      default: false,
    },
    'terminal.scrollback': {
      type: 'number',
      default: 5000,
    },
    [CodeTerminalSettingId.ShellArgsLinux]: {
      type: 'array',
      default: [],
      description: '%preference.terminal.integrated.shellArgs.linuxDesc%',
      markdownDeprecationMessage: shellDeprecationMessageLinux,
    },
    [CodeTerminalSettingId.ShellArgsMacOs]: {
      type: 'array',
      // Unlike on Linux, ~/.profile is not sourced when logging into a macOS session. This
      // is the reason terminals on macOS typically run login shells by default which set up
      // the environment. See http://unix.stackexchange.com/a/119675/115410
      default: ['-l'],
      markdownDeprecationMessage: shellDeprecationMessageOsx,
    },
    [CodeTerminalSettingId.ShellArgsWindows]: {
      type: 'array',
      default: [],
      markdownDeprecationMessage: shellDeprecationMessageWindows,
    },
    [CodeTerminalSettingId.ProfilesWindows]: {
      restricted: true,
      // comment: ['{0}, {1}, and {2} are the `source`, `path` and optional `args` settings keys'],
      markdownDescription: localize(
        'terminal.integrated.profiles.windows',
        'The Windows profiles to present when creating a new terminal via the terminal dropdown. Use the `path` property to automatically detect the shell\'s location. Or set the {1} property manually with an optional `args`.\n\nSet an existing profile to `null` to hide the profile from the list, for example: `"Ubuntu-20.04 (WSL)": null`.',
      ),
      type: 'object',
      default: {},
    },
    [CodeTerminalSettingId.ProfilesMacOs]: {
      restricted: true,
      markdownDescription: localize(
        'terminal.integrated.profile.osx',
        'The macOS profiles to present when creating a new terminal via the terminal dropdown. Set the `path` property manually with an optional `args`.\n\nSet an existing profile to `null` to hide the profile from the list, for example: `"bash": null`.',
      ),
      type: 'object',
      default: {
        bash: {
          path: 'bash',
          args: ['-l'],
          // icon: 'terminal-bash',
        },
        zsh: {
          path: 'zsh',
          args: ['-l'],
        },
        fish: {
          path: 'fish',
          args: ['-l'],
        },
        tmux: {
          path: 'tmux',
          // icon: 'terminal-tmux',
        },
        pwsh: {
          path: 'pwsh',
          // icon: 'terminal-powershell',
        },
      },
    },
    [CodeTerminalSettingId.ProfilesLinux]: {
      restricted: true,
      markdownDescription: localize(
        'terminal.integrated.profile.linux',
        'The Linux profiles to present when creating a new terminal via the terminal dropdown. Set the `path` property manually with an optional `args`.\n\nSet an existing profile to `null` to hide the profile from the list, for example: `"bash": null`.',
      ),
      type: 'object',
      default: {
        bash: {
          path: 'bash',
          icon: 'terminal-bash',
        },
        zsh: {
          path: 'zsh',
        },
        fish: {
          path: 'fish',
        },
        tmux: {
          path: 'tmux',
          icon: 'terminal-tmux',
        },
        pwsh: {
          path: 'pwsh',
          icon: 'terminal-powershell',
        },
      },
    },
    [CodeTerminalSettingId.DefaultProfileLinux]: {
      restricted: true,
      markdownDescription: localize(
        'terminal.integrated.defaultProfile.linux',
        'The default profile used on Linux. This setting will currently be ignored if either {0} or {1} are set.',
      ),
      type: ['string', 'null'],
      default: null,
    },
    [CodeTerminalSettingId.DefaultProfileMacOs]: {
      restricted: true,
      markdownDescription: localize(
        'terminal.integrated.defaultProfile.osx',
        'The default profile used on macOS. This setting will currently be ignored if either {0} or {1} are set.',
      ),
      type: ['string', 'null'],
      default: null,
    },
    [CodeTerminalSettingId.DefaultProfileWindows]: {
      restricted: true,
      markdownDescription: localize(
        'terminal.integrated.defaultProfile.windows',
        'The default profile used on Windows. This setting will currently be ignored if either {0} or {1} are set.',
      ),
      type: ['string', 'null'],
      default: null,
    },
  },
};
