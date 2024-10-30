import os from 'os';
import path from 'path';

import fs from 'fs-extra';

import { Injectable } from '@opensumi/di';

export interface IShellIntegrationService {
  // 初始化 Bash 注入文件，幂等设计，返回注入文件路径
  initBashInitFile(): Promise<string>;

  // 获取 Bash 注入文件的 Content 内容
  getBashIntegrationContent(): Promise<string>;

  // 初始化 zsh 注入的配置，并且返回配置的路径
  initZshDotFiles(): Promise<string>;
}

// 未来适配 OpenSumi 的时候需要调整
export const shellIntegrationDirPath = path.join(os.tmpdir(), '.sumi-shell', 'shell-integration');

export const bashIntegrationPath = path.join(shellIntegrationDirPath, 'bash-integration.bash');

export const IShellIntegrationService = Symbol('IShellIntegrationService');

/**
 * 可通过重写此 Service 做到自定义的 Bash 注入
 * 后续增加 ZSH 的支持
 */
@Injectable()
export class ShellIntegrationService implements IShellIntegrationService {
  /**
    注入的 bash initFile，用于 ShellIntegration 功能的搭建
    可覆写此文件，实现自定义的注入
    *注意*：要保持 prompt_start 和 prompt_end 的注入，否则会影响 IDE 的终端智能
  */
  async getBashIntegrationContent(): Promise<string> {
    return String.raw`

    if [ -r /etc/profile ]; then
        . /etc/profile
    fi
    if [ -r ~/.bashrc ]; then
        . ~/.bashrc
    fi
    if [ -r ~/.bash_profile ]; then
        . ~/.bash_profile
    elif [ -r ~/.bash_login ]; then
        . ~/.bash_login
    elif [ -r ~/.profile ]; then
        . ~/.profile
    fi
    
    __is_prompt_start() {
      builtin printf '\e]6973;PS\a' # 标记 Shell Prompt Start，使其可被 IDE 上层感知，用于终端智能
    }
    
    __is_prompt_end() {
      builtin printf '\e]6973;PE\a' # 用于标记 Shell Prompt End，作用同上
    }
    
    __is_update_prompt() {
      if [[ "$__is_custom_PS1" == "" || "$__is_custom_PS1" != "$PS1" ]]; then
            __is_original_PS1=$PS1
            __is_custom_PS1="\[$(__is_prompt_start)\]$__is_original_PS1\[$(__is_prompt_end)\]"
            export PS1="$__is_custom_PS1"
        fi
    }
    
    __is_update_prompt
    `;
  }

  // 可被集成侧覆写以自定义 Bash 注入文件
  async initBashInitFile(): Promise<string> {
    await fs.mkdirp(shellIntegrationDirPath);
    await fs.writeFile(bashIntegrationPath, await this.getBashIntegrationContent());
    return bashIntegrationPath;
  }

  // ZSH 的智能化基于 ZDOTDIR 能力运行
  async initZshDotFiles(): Promise<string> {
    const zDotDir = path.join(os.tmpdir(), 'sumi-integration-zsh');
    await this.writeZshConfigShellScripts(zDotDir);
    return zDotDir;
  }

  private async writeZshConfigShellScripts(outputDir: string) {
    // 定义文件内容
    const shellIntegrationEnv = String.raw`
if [[ -f $USER_ZDOTDIR/.zshenv ]]; then
    SUMI_ZDOTDIR=$ZDOTDIR
    ZDOTDIR=$USER_ZDOTDIR

    # prevent recursion
    if [[ $USER_ZDOTDIR != $SUMI_ZDOTDIR ]]; then
        . $USER_ZDOTDIR/.zshenv
    fi

    USER_ZDOTDIR=$ZDOTDIR
    ZDOTDIR=$SUMI_ZDOTDIR
fi
`;

    const shellIntegrationLogin = String.raw`
if [[ -f $USER_ZDOTDIR/.zlogin ]]; then
    ZDOTDIR=$USER_ZDOTDIR
    . $ZDOTDIR/.zlogin
fi
`;

    // 处理 zProfile 的情况，需要临时切回用户的 zshrc 目录配置执行 zProfile，然后记得要切回来，否则 zshrc hack 不生效
    const shellIntegrationProfile = String.raw`
if [[ -f $USER_ZDOTDIR/.zprofile ]]; then
    SUMI_ZDOTDIR=$ZDOTDIR
    ZDOTDIR=$USER_ZDOTDIR
    . $USER_ZDOTDIR/.zprofile
    ZDOTDIR=$SUMI_ZDOTDIR
fi
`;

    const shellIntegrationRc = `
builtin autoload -U add-zsh-hook

if [[ -f $USER_ZDOTDIR/.zshrc ]]; then
    ZDOTDIR=$USER_ZDOTDIR
    . $USER_ZDOTDIR/.zshrc
fi

__is_prompt_start() {
    builtin printf '\\e]6973;PS\\a'
}

__is_prompt_end() {
    builtin printf '\\e]6973;PE\\a'
}

__is_escape_value() {
    builtin emulate -L zsh

    # Process text byte by byte, not by codepoint.
    builtin local LC_ALL=C str="$1" i byte token out=''

    for (( i = 0; i < \${#str}; ++i )); do
        byte="\${str:$i:1}"

        # Escape backslashes and semi-colons
        if [ "$byte" = "\\\\" ]; then
            token="\\\\\\\\"
        elif [ "$byte" = ";" ]; then
            token="\\\\x3b"
        elif [ "$byte" = $'\\n' ]; then
            token="\\\\x0a"
        elif [ "$byte" = $'\\e' ]; then
            token="\\\\x1b"
        elif [ "$byte" = $'\\a' ]; then
            token="\\\\x07"
        else
            token="$byte"
        fi

        out+="$token"
    done

    builtin print -r "$out"
}

__is_update_cwd() {
    builtin printf '\\e]6973;CWD;%s\\a' "$(__is_escape_value "\${PWD}")"
}

__is_update_prompt() {
    __is_prior_prompt="$PS1"
    if [[ $ISTERM_TESTING == "1" ]]; then
        __is_prior_prompt="> "
    fi
    PS1="%{\$(__is_prompt_start)%}\$__is_prior_prompt%{\$(__is_prompt_end)%}"
}

__is_precmd() {
    if [[ $PS1 != *"\$(__is_prompt_start)"* ]]; then
        __is_update_prompt
    fi
    __is_update_cwd
}

__is_update_prompt
add-zsh-hook precmd __is_precmd
`;

    const files = [
      { name: '.zshenv', content: shellIntegrationEnv },
      { name: '.zlogin', content: shellIntegrationLogin },
      { name: '.zprofile', content: shellIntegrationProfile },
      { name: '.zshrc', content: shellIntegrationRc },
    ];

    await fs.mkdir(outputDir, { recursive: true });

    for (const file of files) {
      const filePath = path.join(outputDir, file.name);
      await fs.writeFile(filePath, file.content, 'utf-8');
    }
  }
}
