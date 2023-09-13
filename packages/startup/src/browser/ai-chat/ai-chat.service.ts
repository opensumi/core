import { Injectable, Autowired } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { Emitter, Event, CommandService } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import { AISerivceType, AiGPTBackSerivcePath } from '../../common';

const aiSearchKey = '/search ';
const aiSearchCodeKey = '/searchcode ';
const aiSumiKey = '/sumi';
const aiExplainKey = '/explain';

@Injectable()
export class AiChatService {

  @Autowired(AiGPTBackSerivcePath)
  aiBackService: any;

  @Autowired(CommandService)
  protected readonly commandService: CommandService;

  @Autowired(PreferenceService)
  protected preferenceService: PreferenceService;

  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorServiceImpl;

  private readonly _onChatMessageLaunch = new Emitter<string | React.ReactNode>();
  public readonly onChatMessageLaunch: Event<string | React.ReactNode> = this._onChatMessageLaunch.event;

  public launchChatMessage(message: string | React.ReactNode) {
    this._onChatMessageLaunch.fire(message);
  }

  public async switchAIService(input: string) {
    let type: AISerivceType | undefined;
    let message: string | undefined;

    const currentEditor = this.editorService.currentEditor;
    if (!currentEditor) {
      return;
    }

    
    const currentUri = currentEditor.currentUri;
    if (!currentUri) {
      return;
    }

    
    if (input === '解释代码') { 
      // 获取指定范围内的文本内容
      const selection = currentEditor.monacoEditor.getSelection();
      if (!selection) {
        return;
      }
      const selectionContent = currentEditor.monacoEditor.getModel()?.getValueInRange(selection);
      const messageWithPrompt = `解释以下这段代码。\n \`\`\`${selectionContent}\`\`\``;

      return { type: AISerivceType.GPT, message: messageWithPrompt };
    }

    if (input.startsWith(aiSumiKey)) {
      type = AISerivceType.Sumi;
      message = input.split(aiSumiKey)[1];

      return { type: AISerivceType.Sumi, message: message };
    }

    if (input.startsWith(aiExplainKey)) { 
      message = input.split(aiExplainKey)[1];
      const displayName = currentUri.displayName;
      const content = currentEditor.monacoEditor.getValue();
      const messageWithPrompt = `我有一个 ${displayName} 文件，代码内容是 \`\`\`\n${content}\n\`\`\`. 此时有个异常问题是 "${message}", 请给我解释这个异常问题并给出修复建议`;

      return { type: AISerivceType.Explain, message: messageWithPrompt };
    }

    return { type: AISerivceType.GPT, message: input };

    // 单独处理 解释代码
    if (input === '解释代码') {
      return { type: AISerivceType.GPT, message: input };
    }

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

          // @ts-ignore
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
    // const messageWithPrompt = `You are a developer proficient in vscode extension development.I will ask you some questions about extension development.
    // If a certain problem can be solved using a Command, please provide the command.
    // If it's related to modifying configurations, please specify the category and identifier of the configuration item, along with an example code.
    // An example question is as follow: “修改字体大小为 20 像素”.
    // And then, give me an answer such as: “
    // ConfigCategory: editor
    // ConfigKey: fontSize
    // ConfigParams: 16
    // Example:
    // \`\`\`
    // const config = vscode.workspace.getConfiguration('editor');
    // config.update('fontSize', 16, vscode.ConfigurationTarget.Global);
    // \`\`\`
    // ”
    // Another example is : “唤起弹窗”
    // And answer such as :”
    // Command: workbench.action.openGlobalKeybindings
    // Example:
    // \`\`\`
    // vscode.workspace.executeCommand('workbench.action.openGlobalKeybindings')
    // \`\`\`
    // ”
    // (You need to distinguish between whether it's a Command or a Config in your answers and provide the corresponding format. Simply provide content similar to the examples given without the need for explanations.)
    // My question is: ${input}`;
    // const messageWithPrompt = `
    // You are a professional vscode plugin developer, and I have some questions about plugin development to ask you. Please provide API and give example codes with javascript.
    // An example question is as follow: "修改字体大小为 20 像素"
    // And then, give me an answer such as: "
    //   API: vscode.workspace.getConfiguration
    //   Example:
    //   \`\`\`
    //       const config = vscode.workspace.getConfiguration('editor');
    //       config.update('fontSize', 20, vscode.ConfigurationTarget.Global);
    //   \`\`\`
    // "
    // (Please just provide example code and API, do not give other words)
    // My question is: ${input}`;

    // const messageWithPrompt = `你是一位精通 vscode 的开发者，我会问你一些关于 vscode 的问题。
    // 如果某个问题可以使用命令解决，请提供该命令，并给我解释。
    // 示例问题如下：\"打开设置面板\"，
    // 然后回答：\"
    // 您可以用以下命令 xxxxx:
    // 1. xxx
    // 2. xxxx
    // 3. xxxx
    
    // 命令：workbench.action.openSettings
    // 例子：
    // \`\`\`
    // vscode.workspace.executeCommand('workbench.action.openSettings')
    // \`\`\`
    // ”
    // （您需要提供相应的格式回答。同时需要解释我的问题需要哪些操作。）
    // 我的问题是：${input}`

    const messageWithPrompt = `You are a developer proficient in vscode, I will ask you some questions about vscode.
    If a problem can be solved with a command, please provide that command and explain it to me.
    A sample question would be: \"打开设置面板\",
    Then answer: \"
    You can use the following command xxxxx:
    1. xxx
    2. xxxx
    3. xxxx
    
    Command: workbench.action.openGlobalKeybindings
    Example:
    \`\`\`
    vscode.workspace.executeCommand('workbench.action.openGlobalKeybindings')
    \`\`\`
    "
    (You need to distinguish between Command and Config in your answer and provide the appropriate format. Also explain what actions my question requires. 用中文回答我，其中 Command 和 Example 不用翻译)
    My problem is: ${input}`

    const res = await this.aiBackService.aiGPTcompletionRequest(messageWithPrompt);

    console.log('aiCodeGPTcompletionRequest with sumi: >>>> ', res);
    return res.data;
  }

  public async messageWithGPT(input: string) {
    const res = await this.aiBackService.aiGPTcompletionRequest(input);
    console.log('messageWithGPT: >>>> ', res);
    return res.data;
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

  codeStructure: RegExpExecArray | null;

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
