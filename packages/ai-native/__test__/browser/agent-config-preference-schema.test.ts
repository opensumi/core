import Ajv from 'ajv';

import { AINativeSettingSectionsId } from '@opensumi/ide-core-common';

import { aiNativePreferenceSchema } from '../../src/browser/preferences/schema';

describe('AI Native agent configuration preference schema', () => {
  const agentConfigsSchema = aiNativePreferenceSchema.properties[AINativeSettingSectionsId.AgentConfigs];
  const validateAgentConfigs = new Ajv().compile(agentConfigsSchema);

  it('guides settings.json users toward the object-map format', () => {
    expect(agentConfigsSchema.type).toBe('object');
    expect(agentConfigsSchema.default).toEqual({
      qwen: {
        command: 'qwen',
        args: ['--acp', '--channel=ACP', '--input-format=stream-json', '--output-format=stream-json'],
        streaming: true,
        description: 'Qwen CLI Agent',
      },
      'claude-agent-acp': {
        command: 'claude-agent-acp',
        args: [],
        streaming: true,
        description: 'Claude Code ACP Agent',
      },
    });
    expect(validateAgentConfigs(agentConfigsSchema.default)).toBe(true);
    expect(agentConfigsSchema.defaultSnippets).toEqual([
      {
        label: 'acp default agent configs',
        description: '%preference.ai.native.agent.configs.snippet.description%',
        bodyText:
          '{\n\t"qwen": {\n\t\t"command": "qwen",\n\t\t"args": ["--acp", "--channel=ACP", "--input-format=stream-json", "--output-format=stream-json"],\n\t\t"streaming": true,\n\t\t"description": "Qwen CLI Agent"\n\t},\n\t"claude-agent-acp": {\n\t\t"command": "claude-agent-acp",\n\t\t"args": [],\n\t\t"streaming": true,\n\t\t"description": "Claude Code ACP Agent"\n\t}\n}',
      },
    ]);
    expect(agentConfigsSchema.examples).toEqual([
      {
        qwen: {
          command: 'qwen',
          args: ['--acp', '--channel=ACP', '--input-format=stream-json', '--output-format=stream-json'],
          streaming: true,
          description: 'Qwen CLI Agent',
        },
        'claude-agent-acp': {
          command: 'claude-agent-acp',
          args: [],
          streaming: true,
          description: 'Claude Code ACP Agent',
        },
      },
    ]);
    expect(agentConfigsSchema.errorMessage).toBe('%preference.ai.native.agent.configs.errorMessage%');
    expect(agentConfigsSchema.additionalProperties.errorMessage).toBe(
      '%preference.ai.native.agent.configs.item.errorMessage%',
    );
    expect(agentConfigsSchema.markdownDescription).toContain('preference.ai.native.agent.configs.markdownDescription');
  });

  it('rejects string agent configs and accepts object-map agent configs', () => {
    expect(validateAgentConfigs('acp')).toBe(false);

    expect(
      validateAgentConfigs({
        'custom-agent': {
          command: 'custom-agent',
          args: ['--acp'],
          streaming: true,
          description: 'Custom Agent',
        },
      }),
    ).toBe(true);
  });

  it('requires each configured agent to define a non-empty command', () => {
    expect(
      validateAgentConfigs({
        'custom-agent': {
          args: ['--acp'],
        },
      }),
    ).toBe(false);

    expect(
      validateAgentConfigs({
        'custom-agent': {
          command: '',
        },
      }),
    ).toBe(false);
  });
});
