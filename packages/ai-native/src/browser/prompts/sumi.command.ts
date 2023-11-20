import { Injectable } from '@opensumi/di';

import { PromptOption } from '../../common';

import { PromptManager } from './prompt-manager';

@Injectable()
export class SumiCommandPromptManager extends PromptManager {
  groupCommand(commandString: string, option?: PromptOption) {
    return this.removeExtraSpace(option?.language === 'zh' ? this.zhGroupCommandPrompt(commandString, option?.useCot) : this.enGroupCommandPrompt(commandString, option?.useCot));
  }

  private groupCommandCotPrompt = `
    Commands: git.commit,git.commitStaged,theme.toggle
    Output:
    * [File and Editor Management]: 
    * [Version Control and Git]: git.commit,git.commitStaged
    * [Debugging and Testing]: 
    * [Terminal and Command Line]: 
    * [User Interface and Layout Management]: theme.toggle
    * [Code Editing and Refactoring]: 
    * [Search and Navigation]: 
    * [Extensions and Customization]: 
    * [Data Science and Notebooks]: 
    * [Accessibility and Help]: 
  `;

  private enGroupCommandPrompt(commands: string, useCot = true) {
    return `
      In my software, there are some commands that can be categorized into different groups. I will provide all the groups, group descriptions, and the commands in the system. Please help me find the appropriate group for these commands, based on the command names or descriptions.
      
      Groups:
      * [File and Editor Management]: Includes commands related to file operations such as creation, opening, saving, closing, and other file management functions.
      * [Version Control and Git]: Covers commands related to version control systems, especially Git, including committing changes, branch operations, pulling, and pushing.
      * [Debugging and Testing]: Encompasses commands related to debugging programs and testing code, such as starting or stopping debugging sessions, setting breakpoints, and running tests.
      * [Terminal and Command Line]: Includes commands related to managing the terminal and command-line interface, such as opening, splitting the terminal, executing terminal commands, etc.
      * [User Interface and Layout Management]:  Involves commands for customizing the user interface and editor layout, including adjusting sidebars, changing view layouts, theme switching, etc.
      * [Code Editing and Refactoring]: Comprises text editing and code refactoring commands, including formatting, refactoring, text editing, code navigation, and more.
      * [Search and Navigation]: Focuses on commands for code searching and navigation, including symbol search, in-file search, and navigating to specific code locations.
      * [Extensions and Customization]: Pertains to commands for installing, managing, and configuring extensions and plugins, as well as extension-specific functionalities.
      * [Data Science and Notebooks]: Includes commands for operations with data science and Jupyter Notebooks, such as running cells, exporting notebooks, etc.
      * [Accessibility and Help]: Covers commands that enhance accessibility features and user support, such as accessing help documentation, enabling accessibility features, etc.
      
      ${useCot ? this.groupCommandCotPrompt : ''}

      Commands: ${commands}
      Output:
    `;
  }

  private zhGroupCommandPrompt(commands: string, useCot = true) {
    return `
      在我的软件中有一些指令，这些指令可以被分类至不同的分组，我会给出全部的分组和分组简介，以及系统内的指令。请帮我将这些命令找到合适的分组，可以根据指令的命名或者描述
      
      分组描述:
      * [File and Editor Management]: 包括所有与文件操作相关的指令，如文件的创建、打开、保存、关闭以及其他文件管理功能。
      * [Version Control and Git]: 涵盖与版本控制系统（尤其是Git）相关的指令，如提交更改、分支操作、拉取和推送等。
      * [Debugging and Testing]: 囊括了与程序调试和代码测试相关的指令，包括启动或停止调试会话、设置断点、运行测试等
      * [Terminal and Command Line]: 包括与终端和命令行界面相关的管理操作，如打开、分割终端，执行终端命令等
      * [User Interface and Layout Management]: 涉及对用户界面和编辑器布局进行自定义设置的指令，包括调整侧边栏、更改视图布局、主题切换等。
      * [Code Editing and Refactoring]: 包括文本编辑和代码重构的指令，如格式化、重构、编辑文本、代码导航等。
      * [Search and Navigation]: 专注于代码搜索和导航的指令，包括符号搜索、文件内搜索和导航到特定代码位置等。
      * [Extensions and Customization]: 涉及扩展和插件的安装、管理和配置，以及扩展特定功能的指令。
      * [Data Science and Notebooks]: 包括数据科学和Jupyter Notebook操作的指令，如运行单元格、导出笔记本等。
      * [Accessibility and Help]: 涵盖提高辅助功能和用户支持的指令，如访问帮助文档、开启辅助功能等。
      
      ${useCot ? this.groupCommandCotPrompt : ''}
      
      Commands: ${commands}
      Output:
    `;
  }

  searchGroup(input: string, option?: PromptOption) {
    return this.removeExtraSpace(option?.language === 'zh' ? this.zhSearchGroupPrompt(input, option?.useCot) : this.enSearchGroupPrompt(input, option?.useCot));
  }

  private searchGroupCotPrompt = `
    Input: 提交代码
    Output: commit code maybe in group [Version Control and Git]
    Input: 放大字体
    Output: zoom font maybe in group [Code Editing and Refactoring]
  `;

  private enSearchGroupPrompt(input: string, useCot?: boolean) {
    return `
      In my software, there are some commands that can be grouped into several categories. Below are all the groups and a brief description of each group. Please identify the corresponding group based on the functionality provided by the user.

      Groups:
      * [File and Editor Management]: Includes commands related to file operations such as creation, opening, saving, closing, and other file management functions.
      * [Version Control and Git]: Covers commands related to version control systems, especially Git, including committing changes, branch operations, pulling, and pushing.
      * [Debugging and Testing]: Encompasses commands related to debugging programs and testing code, such as starting or stopping debugging sessions, setting breakpoints, and running tests.
      * [Terminal and Command Line]: Includes commands related to managing the terminal and command-line interface, such as opening, splitting the terminal, executing terminal commands, etc.
      * [User Interface and Layout Management]:  Involves commands for customizing the user interface and editor layout, including adjusting sidebars, changing view layouts, theme switching, etc.
      * [Code Editing and Refactoring]: Comprises text editing and code refactoring commands, including formatting, refactoring, text editing, code navigation, and more.
      * [Search and Navigation]: Focuses on commands for code searching and navigation, including symbol search, in-file search, and navigating to specific code locations.
      * [Extensions and Customization]: Pertains to commands for installing, managing, and configuring extensions and plugins, as well as extension-specific functionalities.
      * [Data Science and Notebooks]: Includes commands for operations with data science and Jupyter Notebooks, such as running cells, exporting notebooks, etc.
      * [Accessibility and Help]: Covers commands that enhance accessibility features and user support, such as accessing help documentation, enabling accessibility features, etc.
      
      ${useCot ? this.searchGroupCotPrompt : ''}
      Input：${input}
      Output: [group name]
    `;
  }

  private zhSearchGroupPrompt(input: string, useCot?: boolean) {
    return `
      在我的软件中，存在一些指令，这些指令可以被分成几组，下面给出全部的分组及分组简介，请针对用户给出的功能，找到对应的分组。

      指令分组：
      * [File and Editor Management]: 包括所有与文件操作相关的指令，如文件的创建、打开、保存、关闭以及其他文件管理功能。
      * [Version Control and Git]: 涵盖与版本控制系统（尤其是Git）相关的指令，如提交更改、分支操作、拉取和推送等。
      * [Debugging and Testing]: 囊括了与程序调试和代码测试相关的指令，包括启动或停止调试会话、设置断点、运行测试等
      * [Terminal and Command Line]: 包括与终端和命令行界面相关的管理操作，如打开、分割终端，执行终端命令等
      * [User Interface and Layout Management]: 涉及对用户界面和编辑器布局进行自定义设置的指令，包括调整侧边栏、更改视图布局、主题切换等。
      * [Code Editing and Refactoring]: 包括文本编辑和代码重构的指令，如格式化、重构、编辑文本、代码导航等。
      * [Search and Navigation]: 专注于代码搜索和导航的指令，包括符号搜索、文件内搜索和导航到特定代码位置等。
      * [Extensions and Customization]: 涉及扩展和插件的安装、管理和配置，以及扩展特定功能的指令。
      * [Data Science and Notebooks]: 包括数据科学和Jupyter Notebook操作的指令，如运行单元格、导出笔记本等。
      * [Accessibility and Help]: 涵盖提高辅助功能和用户支持的指令，如访问帮助文档、开启辅助功能等。
      
      ${useCot ? this.searchGroupCotPrompt : ''}
      提问: ${input}
      回答: [分组名称]
    `;
  }

  findCommand(input: { commands: string; question: string }, option?: PromptOption) {
    return this.removeExtraSpace(option?.language === 'zh' ? this.zhFindCommandPrompt(input, option?.useCot) : this.enFindCommandPrompt(input, option?.useCot));
  }

  private findCommandCotPrompt = `
    提问: 打开全局快捷键配置
    回答: 通过分析需求「打开全局快捷键配置」, 可以获取到一些关键词： open、keybinding、global。通过这些关键词可以在 Command 的列表内匹配到相关的命令是： \`workbench.action.openGlobalKeybindings\`
    提问: 提交代码
    回答: 通过分析需求「提交代码」，可以获取到一些关键词：git、commit。通过这些关键词可以在 Command 的列表内匹配到相关的命令是： \`git.commit\`
  `;

  private enFindCommandPrompt(input: { commands: string; question: string }, useCot = true) {
    return `
      In my system, there are some Commands. Through these commands, certain functions can be achieved. Please analyze my question to determine the function I want to implement, and match the appropriate Command.
      Please refer to the example Q&A below and return in the format of the example answer. If no suitable command is found, please return 'No suitable command found.'
      I will provide all the commands in the system and their descriptions in the format of {command}-{description}. When analyzing the question, please refer to both the command and its description.
      Below are all the Commands and their descriptions in the system:
      ${input.commands}
      {workbench.action.openGlobalKeybindings}-{Keybindings}
      {editor.action.setEncoding}-{set encoding}
      
      ${useCot ? this.findCommandCotPrompt : ''}
      提问: ${input.question}
    `;
  }

  private zhFindCommandPrompt(input: { commands: string; question: string }, useCot = true) {
    return `
      在系统中，有一些指令可以实现某些功能。请分析我的问题，确定我想要实现的功能，并匹配适当的指令。
      请参考下面的示例问答，并以示例答案的格式返回。如果找不到合适的指令，请返回“未找到合适的指令。”
      我会提供系统中的所有指令及其描述，格式为{指令}-{描述}。在分析问题时，请参考指令和其描述。
      以下是系统中的所有指令及其描述：
      ${input.commands}
      {workbench.action.openGlobalKeybindings}-{Keybindings}
      {editor.action.setEncoding}-{set encoding}
      
      ${useCot ? this.findCommandCotPrompt : ''}
      提问: ${input.question}
    `;
  }
}
