import os from 'os';
import path from 'path';

import fs from 'fs-extra';

import { Injectable } from '@opensumi/di';

export interface IShellIntegrationService {
  // 初始化 Bash 注入文件，幂等设计，返回注入文件路径
  initBashInitFile(): Promise<string>;

  // 获取 Bash 注入文件的 Content 内容
  getBashIntegrationContent(): Promise<string>;
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
      builtin printf '\e]6973;CWD;$PWD\a' # 记录当前目录
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
}
