/* eslint-disable no-console */
import { Injectable, Autowired } from '@opensumi/di';
import { AiGPTBackSerivcePath } from '../../../common';

const enum FRAMEWORK {
  minifish = 'minifish',
  bigfish = 'bigfish',
  sofa = 'sofa'
}

interface Requirements {
  language: string;
  framework: string;
  requirements: string;
}

@Injectable()
export class AiProjectGenerateService {
  @Autowired(AiGPTBackSerivcePath)
  aiBackService: any;

  private matchFramework(language: string, framework: string) {
    if (/javascript|typescript/i.test(language)) {
      return /minifish/i.test(framework) ? FRAMEWORK.minifish : FRAMEWORK.bigfish;
    }

    if (/java/i.test(language)) {
      return FRAMEWORK.sofa;
    }

    return framework;
  }

  public async switchProjectLanguage(input: string) {
    const prompt = `
    ### 介绍 ###
    我会提供一份关于编程项目的描述，请基于项目描述提取出项目所使用的编程语言、适合的编程框架，以及分析一下项目的具体需求。
    如果是支付宝小程序相关的需求，编程语言为 Javascript，编程框架使用: Minifish
    如果是与前端有关的需求，编程语言为 Typescript，编程框架请使用: Bigfish
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
    }) as ({ language: string; framework: string[]; requirements: string });
  }

  private generateStructurePrompt({ language, framework }: Requirements) {
    switch (this.matchFramework(language, framework)) {
      case FRAMEWORK.minifish:
        return `
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
      case FRAMEWORK.bigfish:
        return `
├──package.json
├──app.tsx
├──README.md
├──.gitignore
├──.eslintrc
├──src
│  └──pages
│     └──order
│        ├──index.tsx
│        └──index.less
└──config
   ├──config.ts
   └──router.config.ts
        `;
      default:
        return `
├──.gitignore
├──pom.xml
├──README.md
└──app
   ├──bootstrap
   │  ├──src
   │  │  ├──main
   │  │  │  ├──java
   │  │  │  │  └──com
   │  │  │  │     └──alipay
   │  │  │  │        └──order
   │  │  │  │           └──DemoApplication.java
   │  │  │  └──resources
   │  │  │     └──config
   │  │  │        └──application.properties
   │  │  └──test
   │  │     └──java
   │  │        └──com
   │  │           └──alipay
   │  │              └──order
   │  │                 └──DemoApplicationTest.java
   │  └──pom.xml
   ├──model
   │  ├──src
   │  │  ├──main
   │  │  │  ├──java
   │  │  │  │  └──com
   │  │  │  │     └──alipay
   │  │  │  │        └──order
   │  │  │  │           └──model
   │  │  └──test
   │  │     └──java
   │  │        └──com
   │  │           └──alipay
   │  │              └──order
   │  │                 └──model
   │  └──pom.xml
   ├──service
   │  ├──src
   │  │  ├──main
   │  │  │  ├──java
   │  │  │  │  └──com
   │  │  │  │     └──alipay
   │  │  │  │        └──order
   │  │  │  │           └──service
   │  │  └──test
   │  │     └──java
   │  │        └──com
   │  │           └──alipay
   │  │              └──order
   │  │                 └──service
   │  └──pom.xml
   └──utils
        `;
    }
  }

  codeStructure: string;

  public async generateProjectStructure(projectInfo: Requirements) {
    const { language, framework, requirements } = projectInfo;
    const prompt = `
我会提供一份项目的需求，包含使用的编程语言、编程框架、以及项目的具体需求，请结合具体需求，给出代码目录结构。只给出关键的文件以及文件路径即可。

示例提问：使用 ${language} 的 ${framework} 框架，创建一个关于订单的项目
示例回答：\`\`\`${this.generateStructurePrompt(projectInfo)}\`\`\`

(请参照示例回答，根据需求按照回答格式返回答案)
我的问题：${requirements}
    `;
    const structure = await this.aiBackService.aiCodeLLama(prompt);
    console.log('gen structure res: ', structure);

    const structureCode = /```\n?(?<code>[\s\S]*?)```/g.exec(structure);
    console.log('gen structure code: ', structureCode);

    let flag = false;
    let filePathList: string[] = [];
    if (structureCode) {
      filePathList = this.parseFilePath(structureCode.groups?.code || '');
      const filePathRegex = /^([a-zA-Z0-9\s_-]+[\\/])*[a-zA-Z0-9\s_-]*(\.[a-zA-Z0-9]+)+$/;
      if (filePathList.filter((f) => filePathRegex.test(f)).length === filePathList.length) {
        flag = true;
        this.codeStructure = filePathList.join('\n');
      }
    }


    return flag ? filePathList : await this.generateProjectStructure(projectInfo);
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
        stack.splice(depth);
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

    return paths.map((path) => path.replace(/^root\//, ''));
  }

  public async generateFile(filePathList: string[], projectInfo: Requirements, callback: (path: string) => void) {
    switch (this.matchFramework(projectInfo.language, projectInfo.framework)) {
      case FRAMEWORK.minifish:
        return this.generateMinifishProject(filePathList, projectInfo.requirements, callback);
      case FRAMEWORK.bigfish:
        return this.generateBigfishProject(filePathList, projectInfo, callback);
      default:
        return this.generateCommonProject(filePathList, projectInfo, callback);
    }
  }

  private async generateMinifishProject(fileList: string[], requirements: string, callback: (path: string) => void) {
    const singleFileList: string[] = [];
    const dirMap = new Map<string, string[]>();

    fileList.forEach((filePath) => {
      const pathArray = filePath.split('/');
      if (pathArray.length > 1) {
        const dir = pathArray.slice(0, -1).join('/');
        if (dirMap.get(dir)) {
          dirMap.get(dir)?.push(filePath);
        } else {
          dirMap.set(dir, [filePath]);
        }
      } else {
        singleFileList.push(filePath);
      }
    });

    await Promise.all(singleFileList.map(async (path) => {
      callback(path);
      await this.generateMinifishSingleFile(path, requirements);
    }));

    for (const dir of dirMap.values()) {
      dir.forEach((path) => callback(path));
      await this.generateMinifishDirFile(dir, requirements);
    }
  }

  private pointPrompt = `
生成的代码需要注意以下几点：
1. 生成的代码需要使用 Markdown 的代码块的语法。例如: \`\`\` // code \`\`\`。
2. 支付宝小程序的 axml 语法是 a:xxx 不是 wx:xxx。例如：a:if
3. axml文件时间绑定语法请使用 onEvent。例如：onTap、onInput
  `;

  private requirementPrompt = (requirements: string) => `
项目完整需求如下: ${requirements}
需求对应的完整的文件目录如下：\`\`\`
${this.codeStructure}
\`\`\`
  `;

  private async generateMinifishSingleFile(filePath: string, requirements: string) {
    const commonFile = ['mini.project.json', 'README.md', '.gitignore'];
    let code;
    if (commonFile.find((f) => f === filePath)) {
      code = template[filePath];
    } else {
      const prompt = `
基于我提供的项目需求与文件路径，生成对应的代码。我的需求可能需要多个文件才能满足，我会提供完整的目录结构，但每次我只会提供一个文件路径。
你需要结合我的需求与完整的项目路径，先判断需要生成的文件属于需求中的哪个页面，再生成代码，
${this.pointPrompt}
${this.requirementPrompt(requirements)}

需要生成的代码文件是: ${filePath}
      `;

      code = await this.generateFileCode(prompt);
    }
    await this.aiBackService.generateFileByPath(filePath, code || '{}');

    return code;
  }

  private async generateMinifishDirFile(filePathList: string[], requirements: string) {
    const axmlFile = filePathList.find((path) => path.endsWith('.axml'));
    if (axmlFile) {
      const axmlCode = await this.generateMinifishSingleFile(axmlFile, requirements);
      const otherFile = filePathList.filter((path) => path !== axmlFile);
      await Promise.all(otherFile.map(async (path) => {
        const prompt = `
我会给出项目的需求，需求可能需要多个页面才能实现，我会提供完整的项目路径，以及其中单个页面的 axml 文件代码。
请帮我基于需要生成的文件路径，先判断属于需求中的哪个页面的文件，再判断文件类型，根据 axml 文件代码，生成对应的 js、acss、json 文件的代码。
${this.pointPrompt}
${this.requirementPrompt(requirements)}

已有的axml文件路径为: ${axmlFile}
已有的axml文件代码为：\`\`\`
${axmlCode}
\`\`\`

需要生成代码文件为：${path}
        `;
        const code = await this.generateFileCode(prompt);
        await this.aiBackService.generateFileByPath(path, code || '{}');
      }));
    } else {
      await Promise.all(filePathList.map((path) => this.generateMinifishSingleFile(path, requirements)));
    }
  }

  private async generateBigfishProject(fileList: string[], projectInfo: Requirements, callback: (path: string) => void) {
    const templateFile = ['package.json'];
    while (fileList.length) {
      const part = fileList.splice(0, 1);
      await Promise.all(part.map(async (file) => {
        callback(file);
        if (templateFile.find((f) => f === file)) {
          await this.aiBackService.generateFileByPath(file, template[file]);
        } else {
          await this.generateBigfishFile(file, projectInfo);
        }
      }));
    }
  }

  private async generateBigfishFile(filePath: string, projectInfo: Requirements) {
    const { requirements, language } = projectInfo;
    const prompt = `
Generate corresponding code based on the project requirements and file path I provided. My requirements may require multiple files to fulfill, and I will provide the complete directory structure, but each time I will only provide one file path.
You need to combine my requirements with the complete project path, first determine which page the file to be generated belongs to in the requirements, and then generate the code.
The project uses front-end technologies such as ${language} and less, and framework is Bigfish with React, the generated code should comply with the corresponding file type.
(The Bigfish framework is an extension of umi.js. The file content can refer to umi.js, but if some function import from umi, it needs to be replaced to bigfish.)
Project requirements is: ${requirements}
Project dir strucutre is：\`\`\`
${this.codeStructure}
\`\`\`

(The generated code needs to be wrapped in Markdown code block syntax and just reply code only)
The code need generate is: ${filePath}`;

      const code = await this.generateFileCode(prompt);
      await this.aiBackService.generateFileByPath(filePath, code || '');

      return code;
  }

  private async generateCommonProject(fileList: string[], projectInfo: Requirements, callback: (path: string) => void) {
    while (fileList.length) {
      const part = fileList.splice(0, 1);
      await Promise.all(part.map(async (file) => {
        callback(file);
        await this.generateCommonFile(file, projectInfo);
      }));
    }
  }

  private async generateCommonFile(filePath: string, projectInfo: Requirements) {
    const { requirements, language, framework } = projectInfo;
    const prompt = `
Generate corresponding code based on the project requirements and file path I provided. My requirements may require multiple files to fulfill, and I will provide the complete directory structure, but each time I will only provide one file path.
You need to combine my requirements with the complete project path, first determine which page the file to be generated belongs to in the requirements, and then generate the code.
The project uses ${language}, and framework is ${framework}, the generated code should comply with the corresponding file type.
Project requirements is: ${requirements}
Project dir strucutre is：\`\`\`
${this.codeStructure}
\`\`\`

(The generated code needs to be wrapped in Markdown code block syntax and just reply code only)
The code need generate is: ${filePath}`;

      const code = await this.generateFileCode(prompt);
      await this.aiBackService.generateFileByPath(filePath, code || '');

      return code;
  }

  private async generateFileCode(prompt: string) {
    let times = 0;
    let code;
    while (!code && times < 5) {
      const content = await this.aiBackService.aiCodeLLama(prompt);
      console.log('gen file content: ', content);
      const codeMatch = /```\w*\n(\/\/\s.*\n)?(?<code>[\s\S]*?)```/g.exec(content);
      code = codeMatch && codeMatch.groups?.code ? codeMatch.groups?.code : content;
      console.log('gen file code: ', code);
      times++;
    }

    return code;
  }

  public async clearWorkspace() {
    await this.aiBackService.clearWorkspace();
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
dist
public
.DS_Store
.nyc_output
.basement
.umi
.umi-production
.idea
.history
.node
`,
  'package.json': `
{
  "name": "new project",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "bigfish build",
    "ci": "bigfish lint",
    "dev": "bigfish dev",
    "devs": "cross-env MOCK=none bigfish dev",
    "format": "prettier --cache --write .",
    "postinstall": "bigfish setup",
    "lint": "bigfish lint",
    "lint:fix": "bigfish lint --fix",
    "oneapi": "npm run oneapi:service && npm run oneapi:mock",
    "oneapi:mock": "bigfish api generate mock",
    "oneapi:service": "bigfish api generate service",
    "prepare": "husky install",
    "setup": "bigfish setup",
    "test": "bigfish test"
  },
  "dependencies": {
    "@alipay/bigfish": "^4.0.157",
    "@alipay/tech-ui": "^3.2.2",
    "@monaco-editor/react": "^4.4.6",
    "antd": "conch-v5"
  },
  "devDependencies": {
    "@ali/ci": "^4.43.0",
    "cross-env": "^7.0.3",
    "husky": "^8.0.1",
    "lint-staged": "^13.0.3",
    "prettier": "^2.7.1",
    "typescript": "^4.1.2"
  },
  "engines": {
    "install-node": "16"
  },
  "ci": {
    "type": "aci",
    "coverage": false
  }
}
`,
};
