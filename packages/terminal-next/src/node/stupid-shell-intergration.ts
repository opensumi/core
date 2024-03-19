import os from 'os';
import path from 'path';

import fs from 'fs-extra';

// 未来适配 OpenSumi 的时候需要调整
export const shellIntergrationDirPath = path.join(os.tmpdir(), '.sumi-shell', 'shell-intergration');

export const bashIntergrationPath = path.join(shellIntergrationDirPath, 'bash-intergration.bash');

/**
  注入的 bash initfile，用于 ShellIntergration 功能的搭建
  后续会针对 ShellIntergation 做整体的架构设计，目前满足基础功能需求
 */
export const bashIntergrationContent = String.raw`

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
	builtin printf '\e]6973;PS\a'
}

__is_prompt_end() {
	builtin printf '\e]6973;PE\a'
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

export const initShellIntergrationFile = async () => {
  await fs.mkdirp(shellIntergrationDirPath);
  await fs.writeFile(bashIntergrationPath, bashIntergrationContent);
};
