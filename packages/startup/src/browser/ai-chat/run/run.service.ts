/* eslint-disable no-console */
import { Injectable, Autowired } from '@opensumi/di';
import { CommandService, CommandRegistry, Command, URI, FileType } from '@opensumi/ide-core-common';
import { AiGPTBackSerivcePath } from '../../../common';
import { WorkspaceVariableContribution } from '@opensumi/ide-workspace/lib/browser/workspace-variable-contribution';
import { PreferenceConfigurations } from '@opensumi/ide-core-browser';
import { DebugConfigurationManager } from '@opensumi/ide-debug/lib/browser/debug-configuration-manager';
import { DEBUG_COMMANDS } from '@opensumi/ide-debug';
import * as jsoncparser from 'jsonc-parser';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { AiChatService } from '../ai-chat.service';

// 暂定的技术栈集合
enum EStackName {
  NODEJS = 'node.js',
  JAVA = 'java',
  MINI_PROGRAM = 'mini program',
  PYTHON = 'python',
  C_CPP = 'c/c++',
  GO = 'go',
  rust = 'rust',
  FRONT_END = 'front end',
  EXTENSION = 'ide extension',
  EMPTY = 'empty'
}

const EStackNameValues = Object.values(EStackName);

/**
 * 智能运行的逻辑规则如下
 * 以 launch.json 配置为主
 *   a. 如果没有该文件，则智能生成该文件（走 AI）
 *   b. 如果有该文件，则默认运行第一条（后续可以配置）
 */
@Injectable()
export class AiRunService {
  @Autowired(AiGPTBackSerivcePath)
  aiBackService: any;

  @Autowired(CommandService)
  protected readonly commandService: CommandService;

  @Autowired(WorkspaceVariableContribution)
  protected readonly workspaceVariables: WorkspaceVariableContribution;

  @Autowired(PreferenceConfigurations)
  protected readonly preferenceConfigurations: PreferenceConfigurations;

  @Autowired(DebugConfigurationManager)
  protected readonly debugConfigurationManager: DebugConfigurationManager;

  @Autowired(IFileServiceClient)
  private readonly fileSystem: IFileServiceClient;

  @Autowired(AiChatService)
  protected readonly aiChatService: AiChatService;

  private async readResourceContent(resource: URI): Promise<string> {
    try {
      const { content } = await this.fileSystem.readFile(resource.toString());
      return content.toString();
    } catch (error) {
      return '';
    }
  }

  private getLaunchUri(): URI | undefined {
    const workspaceFolderUri = this.workspaceVariables.getWorkspaceRootUri();
    if (!workspaceFolderUri) {
      return undefined;
    }

    const uri = new URI(workspaceFolderUri.toString()).resolve(`${this.preferenceConfigurations.getPaths()[0]}/launch.json`);
    return uri;
  }

  public getStackName(): EStackName {
    // 测试
    return EStackName.NODEJS
    // 测试
    // @ts-ignore
    const stackName = window.ideRuntimeConfig?.stackName?.toLowerCase();

    if (!stackName) {
      return EStackName.EMPTY;
    }

    for (let i = 0; i < EStackNameValues.length; i++) {
      const name = EStackNameValues[i];
      if (stackName.includs(name)) {
        return EStackName[name]
      }
    }

    return EStackName.EMPTY;
  }

  /**
   * 根据技术栈判断
   * 
   * 1. 有 package.json 文件存在的话，则提取 script、name、version、description、egg、bin 这些字段去构造 prompt
   * 2. 如果是 minifish 技术栈，则直接调用命令 "minidev.startDev"
   * 3. java 技术栈通常都会有 launch.json (java debug 插件生成的)。直接调用第一个命令即可
   */
  public async run() {
    
    // current 就是当前选中的 launch 里的某个配置，如果有值代表就是存在 launch.json 文件，且存在某项配置，直接执行就行
    const isDebugConf = this.debugConfigurationManager.current;
    if (isDebugConf) {
      this.commandService.executeCommand(DEBUG_COMMANDS.START.id);
      return;
    }

    const workspaceFolderUri = this.workspaceVariables.getWorkspaceRootUri();
    if (!workspaceFolderUri) {
      return;
    }

    const stackName = this.getStackName();

    if (stackName === EStackName.MINI_PROGRAM) {
      this.commandService.executeCommand('minidev.startDev')
      return;
    }

    if (stackName === EStackName.NODEJS || stackName === EStackName.FRONT_END) {
      const pkgUri = workspaceFolderUri.resolve('package.json');
      const stat = await this.fileSystem.getFileStat(pkgUri.toString());

      if (stat && stat.type === FileType.File) {
        const fileContent = await this.readResourceContent(pkgUri);

        const parseJson = jsoncparser.parse(fileContent);

        const jsonContent = JSON.stringify({
          name: parseJson.name || '',
          version: parseJson.version || '',
          description: parseJson.description || '',
          egg: parseJson.egg || '',
          bin: parseJson.bin || '',
          scripts: parseJson.scripts,
        }, undefined, 1);

        const prompt = `我会给你一个项目类型和 package.json 文件内容。你需要通过分析里面的 scripts 内容，找到合适的运行命令来启动项目。如果找到合适的命令后直接返回，不需要解释。请参照下面的示例问答的格式返回。
提问: 这是一个 node.js 项目，package.json 的文件内容是 \`\`\`\n${{ scripts: { dev: 'npm run dev', test: 'npm run test' } }}\n\`\`\`
回答: dev
提问: 这是一个 front-end 项目，package.json 的文件内容是 \`\`\`\n${{ scripts: { start: 'npm run start', build: 'npm run build' } }}\n\`\`\`
回答: start
提问: 这是一个 ${stackName} 项目，package.json 的文件内容是 \`\`\`\n${jsonContent}\n\`\`\`
`;
        this.aiChatService.launchChatMessage({
          message: '/run 运行项目',
          prompt: prompt
        });
      }
    }

    console.log(this.debugConfigurationManager)
  }

}
