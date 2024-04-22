import { Autowired, Injectable } from '@opensumi/di';
import { ClientAppContribution, Domain } from '@opensumi/ide-core-browser';
import { IProgressService } from '@opensumi/ide-core-browser/lib/progress';
import { ProgressLocation } from '@opensumi/ide-core-common';
import { DebugConfigurationManager } from '@opensumi/ide-debug/lib/browser/debug-configuration-manager';

@Injectable()
@Domain(ClientAppContribution)
export class DebugConfigurationContribution implements ClientAppContribution {
  @Autowired(DebugConfigurationManager)
  private readonly debugConfigurationManager: DebugConfigurationManager;

  @Autowired(IProgressService)
  private readonly progressService: IProgressService;

  onDidStart() {
    const innerProgressService = this.progressService;
    // 使用模块的时候，需要在这里注册
    this.debugConfigurationManager.registerInternalDebugConfigurationProvider('ai-native', {
      type: 'ai-native',
      label: 'AI 生成配置',
      popupHint:
        '使用大模型能力，根据项目内容生成配置（大模型生成内容可能有误）（大模型生成内容可能有误）（大模型生成内容可能有误）',
      async provideDebugConfigurations(folder, token) {
        await innerProgressService.withProgress(
          {
            location: ProgressLocation.Notification,
            title: '模拟 AI 生成配置中',
          },
          async () => {
            await new Promise((resolve) => {
              setTimeout(() => {
                resolve(undefined);
              }, 5000); // 5 seconds timeout
            });
          },
        );

        // 测试：生成两个配置，然后供用户选择
        return [
          {
            name: '[AI] Launch Program',
            skipFiles: ['<node_internals>/**'],
            type: 'node',
            request: 'launch',
            // autoPick: true, // 使用 autoPick 可以跳过 QuickPick 直接运行（底层逻辑只会检查数组的第一个）
            program: '${workspaceFolder}/index.js',
          },
          {
            name: '[AI2] Run npm start',
            type: 'node',
            request: 'launch',
            runtimeExecutable: 'npm',
            runtimeArgs: ['run', 'start'],
            cwd: '${workspaceFolder}',
            console: 'integratedTerminal',
          },
        ];
      },
    });
    this.debugConfigurationManager.registerInternalDebugConfigurationOverride('pwa-node', {
      type: 'pwa-node',
      label: 'Node.js 项目自动生成',
      popupHint: '通过 Node.js Debug 提供的服务自动分析项目，生成运行配置',
    });
  }
}
