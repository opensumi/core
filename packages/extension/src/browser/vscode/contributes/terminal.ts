import { Injectable, Autowired } from '@opensumi/di';
import { LifeCyclePhase, localize } from '@opensumi/ide-core-common';
import { ITerminalContributions, ITerminalProfileService } from '@opensumi/ide-terminal-next/lib/common';

import { VSCodeContributePoint, Contributes, ExtensionContributePoint, LifeCycle } from '../../../common';

@Injectable()
@Contributes(ExtensionContributePoint.Terminal)
@LifeCycle(LifeCyclePhase.Ready)
export class TerminalContributionPoint extends VSCodeContributePoint<ITerminalContributions> {
  static schema = {
    description: localize('vscode.extension.contributes.terminal', 'Contributes terminal functionality.'),
    type: 'object',
    properties: {
      types: {
        type: 'array',
        description: localize(
          'vscode.extension.contributes.terminal.types',
          'Defines additional terminal types that the user can create.',
        ),
        items: {
          type: 'object',
          required: ['command', 'title'],
          properties: {
            command: {
              description: localize(
                'vscode.extension.contributes.terminal.types.command',
                'Command to execute when the user creates this type of terminal.',
              ),
              type: 'string',
            },
            title: {
              description: localize(
                'vscode.extension.contributes.terminal.types.title',
                'Title for this type of terminal.',
              ),
              type: 'string',
            },
            icon: {
              description: localize(
                'vscode.extension.contributes.terminal.types.icon',
                'A codicon, URI, or light and dark URIs to associate with this terminal type.',
              ),
              anyOf: [
                {
                  type: 'string',
                },
                {
                  type: 'object',
                  properties: {
                    light: {
                      description: localize(
                        'vscode.extension.contributes.terminal.types.icon.light',
                        'Icon path when a light theme is used',
                      ),
                      type: 'string',
                    },
                    dark: {
                      description: localize(
                        'vscode.extension.contributes.terminal.types.icon.dark',
                        'Icon path when a dark theme is used',
                      ),
                      type: 'string',
                    },
                  },
                },
              ],
            },
          },
        },
      },
      profiles: {
        type: 'array',
        description: localize(
          'vscode.extension.contributes.terminal.profiles',
          'Defines additional terminal profiles that the user can create.',
        ),
        items: {
          type: 'object',
          required: ['id', 'title'],
          defaultSnippets: [
            {
              body: {
                id: '$1',
                title: '$2',
              },
            },
          ],
          properties: {
            id: {
              description: localize(
                'vscode.extension.contributes.terminal.profiles.id',
                'The ID of the terminal profile provider.',
              ),
              type: 'string',
            },
            title: {
              description: localize(
                'vscode.extension.contributes.terminal.profiles.title',
                'Title for this terminal profile.',
              ),
              type: 'string',
            },
            icon: {
              description: localize(
                'vscode.extension.contributes.terminal.types.icon',
                'A codicon, URI, or light and dark URIs to associate with this terminal type.',
              ),
              anyOf: [
                {
                  type: 'string',
                },
                {
                  type: 'object',
                  properties: {
                    light: {
                      description: localize(
                        'vscode.extension.contributes.terminal.types.icon.light',
                        'Icon path when a light theme is used',
                      ),
                      type: 'string',
                    },
                    dark: {
                      description: localize(
                        'vscode.extension.contributes.terminal.types.icon.dark',
                        'Icon path when a dark theme is used',
                      ),
                      type: 'string',
                    },
                  },
                },
              ],
            },
          },
        },
      },
    },
  };

  @Autowired(ITerminalProfileService)
  profileService: ITerminalProfileService;
  contribute() {
    for (const contrib of this.contributesMap) {
      const { extensionId, contributes } = contrib;
      this.profileService.addContributedProfile(extensionId, contributes);
    }
  }

  dispose(): void {
    for (const contrib of this.contributesMap) {
      const { extensionId } = contrib;
      this.profileService.removeContributedProfile(extensionId);
    }
  }
}
