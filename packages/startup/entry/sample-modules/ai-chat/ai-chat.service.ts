import { Injectable, Autowired } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { Emitter, Event, CommandService } from '@opensumi/ide-core-common';
import { ExtensionManagementService } from '@opensumi/ide-extension/lib/browser/extension-management.service';
import { AISerivceType, AiGPTBackSerivcePath } from '@opensumi/ide-startup/lib/common/index';

const aiSearchKey = '/search ';
const aiSearchCodeKey = '/searchcode ';
const aiSumiKey = '/sumi';

@Injectable()
export class AiChatService {

  @Autowired(AiGPTBackSerivcePath)
  aiBackService: any;

  @Autowired(CommandService)
  protected readonly commandService: CommandService;

  @Autowired(PreferenceService)
  protected preferenceService: PreferenceService;

  @Autowired()
  protected extensionManagementService: ExtensionManagementService;

  private readonly _onChatMessageLaunch = new Emitter<string | React.ReactNode>();
  public readonly onChatMessageLaunch: Event<string | React.ReactNode> = this._onChatMessageLaunch.event;

  public launchChatMessage(message: string | React.ReactNode) {
    this._onChatMessageLaunch.fire(message);
  }

  public async switchAIService(input: string) {
    let type: AISerivceType | undefined;
    let message: string | undefined;

    const messageWithPrompt = `我会给你一段话，你需要分析并推理出这段话属于以下哪个分类的 tag 里，并返回 tag 的名字给我，tags 的列表有['文本搜索', '代码搜索', 'sumi']。
    例如：“java 生成质数”、“找出所有 markdown 的正则表达式” 等和代码搜索意图强相关的，则返回 '代码搜索'。
    例如：“java 如何生成质数？”、“log4j 官方文档” 等和文本搜索意图强相关的，则返回 '文本搜索'。
    例如：“打开 quick open”、“切换主题” 等和 IDE 有关的交互内容，则返回 'sumi'。
    我给你的这段话是 "${input}"。
    请按照以下格式返回结果：{"tag": "xxx"}`;

    const antglmType = await this.aiBackService.aiAntGlm(messageWithPrompt);

    console.log('antglm result:>>> ', antglmType);

    if (antglmType && antglmType.data) {
      try {
        const toJson = JSON.parse(antglmType.data);
        if (toJson && toJson.tag) {
          const tag = toJson.tag;

          if (tag === '文本搜索') {
            type = AISerivceType.Search;
            message = input;
          } else if (tag === '代码搜索') {
            type = AISerivceType.SearchCode;
            message = input;
          } else if (tag === 'sumi') {
            type = AISerivceType.Sumi;
            message = input;
          }
        }
      } catch (error) {
        type = AISerivceType.Sumi;
        message = input;
      }
    }

    // if (input.startsWith(aiSearchKey)) {
    //   type = AISerivceType.Search;
    //   message = input.split(aiSearchKey)[1];
    // } else if (input.startsWith(aiSearchCodeKey)) {
    //   type = AISerivceType.SearchCode;
    //   message = input.split(aiSearchCodeKey)[1];
    // } else if (input.startsWith(aiSumiKey)) {
    //   type = AISerivceType.Sumi;
    //   message = input.split(aiSumiKey)[1];
    // }

    return { type, message };
  }

  public async messageWithSumi(input: string) {
    const promptWithMessage = `
    ### 介绍 ###
    请根据我的需求返回一个 vscode 插件中可使用的 api，以及示例代码，只返回代码即可
    
    ### 示例 ###
    需求：修改字体大小为 20 像素
    回答：
    API: vscode.workspace.getConfiguration
    Example:
    \`\`\`
      const config = vscode.workspace.getConfiguration('editor');
      config.update('fontSize', 20, vscode.ConfigurationTarget.Global);
    \`\`\`"
    
    ### 命令 ###
    ${input}`;

    const res = await this.aiBackService.aiGPTcompletionRequest(promptWithMessage);

    console.log('aiCodeGPTcompletionRequest: >>>> ', res);

    const exampleReg = /(Example:)?\n*```(javascript)?\n?(?<example>[\s\S]+)```/i;
    const example = exampleReg.exec(res.data);
    if (example) {
      try {
        // await this.aiBackService.writeFile(example.groups?.example);
        // await this.extensionManagementService.postChangedExtension(false, await this.aiBackService.getExtensionPath());
        await this.commandService.executeCommand('aiExt.execute', example.groups?.example);
      } catch (e) {
        console.log('error: ', e);
      }
    }

    // const commandReg = /Command:\s*(?<command>\S+)\s*\n*Example:\s*```\n?(?<example>[\s\S]+)\n```/i;
    // const command = commandReg.exec(res.data);
    // if (command) {
    //   try {
    //     await this.commandService.executeCommand(command.groups?.command!);
    //   } catch {
    //     await this.aiBackService.writeFile(command.groups?.example);
    //     await this.extensionManagementService.postChangedExtension(false, await this.aiBackService.getExtensionPath());
    //   }
    // }

    // const configReg = /ConfigCategory:\s*(?<category>\S+)\s*\n*ConfigKey:\s*(?<key>\S+)\s*\n*ConfigParams:\s*"?(?<params>[^"\n]+)"?\s*\n*Example:\s*\n*```(?<example>[^`]+)```/i;
    // const config = configReg.exec(res.data);
    // if (config) {
    //   const { category, key, params, example } = config.groups || {};
      this.preferenceService.set(`${category}.${key}`, params);
    //   await this.aiBackService.writeFile(example);
    //   await this.extensionManagementService.postChangedExtension(false, await this.aiBackService.getExtensionPath());
    // }
    // setTimeout(() => {
    //   this.removeOldExtension();
    // }, 10000);
  }

  public async removeOldExtension() {
    await this.extensionManagementService.postUninstallExtension(await this.aiBackService.getExtensionPath());
  }

  public async switchProjectLanguage(input: string) {
    const prompt = `
    ### 介绍 ###
    我会提供一份关于编程项目的描述，请基于项目描述提取出项目所使用的编程语言、适合的编程框架，以及分析一下项目的具体需求。
    如果是支付宝小程序相关的需求，编程语言为 Javascript，编程框架使用: Minifish
    如果是与前端有关的需求，编程框架请使用: Bigfish
    下面是一个问答示例，请参照示例的格式，给出回答。

    ### 示例 ###
    示例提问：创建一个 java 项目，与营销相关
    示例回答：
    编程语言: JAVA
    编程框架: Sofa Boot、Sofa4
    项目需求：创建一个用于营销的项目

    ### 需求 ###
    我的问题: ${input}
    `;
    const res = await this.aiBackService.aiAntGlm(prompt);
    console.log('gen request res: ', res);
    const reg = /(编程语言)(:|：)?\s?(?<language>.*)\n*\s*(编程框架)(:|：)?\s?(?<framework>.*)\n*\s*(项目需求)(:|：)?\s?(?<requirements>.*)/i;
    const match = reg.exec(res.data);

    return match && ({
      ...(match.groups || {}),
      framework: match.groups?.framework.split('、'),
    } as { language: string; framework: string[]; requirements: string });
  }

  private generateStructurePrompt(language: string, framework: string) {
    if (/javascript/i.test(language)) {
      // 前端
      if (/minifish/i.test(framework)) {
        // 小程序
        return `
        root
        ├──mini.project.json
        ├──app.js
        ├──app.json
        ├──README.md
        ├──.gitignore
        └──pages
            ├──order
            │   ├──index.js
            │   ├──index.axml
            │   ├──index.acss
            │   └──index.json
            └──detail
                ├──index.js
                ├──index.axml
                ├──index.acss
                └──index.json
        `;
      } else {
        return `
        root
        ├──package.json
        ├──app.tsx
        ├──README.md
        ├──.gitignore
        ├──.eslintrc
        ├──src
        │  └──pages
        │     └──order
        │        ├──index.js
        │        ├──index.axml
        │        ├──index.acss
        │        └──index.json
        └──config
           ├──config.ts
           └──router.config.ts
        `;
      }
    } else if (/java$/i.test(language)) {
      // java
      return `
      src/main/java/com/example/order/controller/OrderApplication.java
      src/main/java/com/example/order/model/OrderModel.java
      src/main/java/com/example/order/repository/OrderRepository.java
      src/main/java/com/example/order/service/OrderService.java
      src/main/java/com/example/order/OrderApplication.java
      src/main/resources/application.properties
      src/main/resources/config/application.yaml
      src/main/resources/data
      src/test/java/com/example/order/OrderControllerTest.java
      src/test/java/com/example/order/OrderApplicationTests.java
      pom.xml
      README.md
      `;
    }
  }

  codeStructure: string;

  public async generateProjectStructure(language: string, framework: string, requirements: string) {
    const prompt = `
    我会提供一份项目的需求，包含使用的编程语言、编程框架、以及项目的具体需求，请结合具体需求，给出代码目录结构。只给出关键的文件以及文件路径即可。

    示例提问：使用 ${language} 的 ${framework} 框架，创建一个关于订单的项目
    示例回答：\`\`\`${this.generateStructurePrompt(language, framework)}\`\`\`

    (请参照示例回答，根据需求按照回答格式返回答案)
    我的问题：${requirements}
    `;
    const structure = await this.aiBackService.aiGPTcompletionRequest(prompt);
    console.log('gen structure res: ', structure);

    const structureCode = /```\n?(?<code>[\s\S]*?)```/g.exec(structure.data);
    this.codeStructure = structureCode;
    console.log('gen structure code: ', structureCode);

    let flag = false;
    let filePathList: string[] = [];
    if (structureCode) {
      filePathList = this.parseFilePath(structureCode.groups?.code || '');
      const filePathRegex = /^([a-zA-Z0-9\s_\-]+[\\/])*[a-zA-Z0-9\s_-]*(\.[a-zA-Z0-9]+)+$/;
      if (filePathList.filter((f) => filePathRegex.test(f)).length === filePathList.length) {
        flag = true;
      }
    }


    return flag ? filePathList : await this.generateProjectStructure(language, framework, requirements);
  }

  private parseFilePath(input: string) {
    const lines = input.split('\n');
    const paths: string[] = [];
    const stack: string[] = [];

    let lastDepth = 0;
    for (const line of lines) {
      if (!/\w/.test(line)) {
        continue;
      }
      const lineWithoutSpace = line.replace(/(├──|└──)\s/g, '$1');
      const match = lineWithoutSpace.match(/(\s)/g);
      const depth = match ? Math.round(match.length / 2) : 0;

      // 获取文件或目录的名称
      const name = lineWithoutSpace.replace(/(├──|└──|│\s+)/g, '').trim();

      // 如果当前深度小于栈的深度，从栈中弹出元素
      if (depth < lastDepth) {
        stack.splice(depth - 1);
      }
      lastDepth = depth;

      while (depth < stack.length) {
        stack.pop();
      }

      if (lineWithoutSpace.indexOf('.') !== -1) {
        const path = [...stack, name].join('/');
        paths.push(path);
      } else {
        // 如果是目录，将其添加到栈中
        stack.push(name);
      }
    }

    return paths;
  }

  public async generateFileContent(filePath: string, requirements: string) {

    const commonFile = ['mini.project.json', 'README.md', '.gitignore'];

    let code;
    if (commonFile.find((f) => f === filePath)) {
       code = template[filePath];
    } else {
      const prompt = `
      基于我提供的项目需求与文件路径，生成对应的代码。我的需求可能需要多个文件才能满足，我会提供完整的目录结构，但每次我只会提供一个文件路径。你需要分析我的需求，找到提供文件相匹配的需求，生成代码，
      文件内容请符合 Markdown 语法。

      文件目录是：${this.codeStructure}
      
      我的需求是：${requirements}
      需要生成的代码文件是: ${filePath}
      `;

      let times = 0;
      while (!code && times < 5) {
        const content = await this.aiBackService.aiGPTcompletionRequest(prompt);
        console.log('gen file content: ', content);
        const codeMatch = /```\w*\n?(?<code>[\s\S]*?)```/g.exec(content.data);
        code = codeMatch && codeMatch.groups?.code;
        console.log('gen file code: ', code);
        times++;
      }

    }
    await this.aiBackService.generateFileByPath(filePath, code || '{}');
  }

  public async generateFile(filePath: string) {
    await this.aiBackService.generateFileByPath(filePath, '');
  }
}

const template = {
  'mini.project.json': `
{
  "enableAppxNg": true
}
`,
  'README.md': `
一个简单的示例 Demo
`,
  '.gitignore': `
logs
node_modules
npm-debug.log
coverage/
run
dist
dist.zip
public
.DS_Store
.nyc_output
.basement
config.local.js
.umi
.umi-production
.idea
distTarget/

config/config.js
speed-measure.json
.history
.node

*.less.d.ts
yarn.lock
`,
};
