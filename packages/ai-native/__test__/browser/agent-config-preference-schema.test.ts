import Ajv from 'ajv';

import { AINativeSettingSectionsId } from '@opensumi/ide-core-common';

import { aiNativePreferenceSchema } from '../../src/browser/preferences/schema';

describe('AI Native agent configuration preference schema', () => {
  const agentConfigsSchema = aiNativePreferenceSchema.properties[AINativeSettingSectionsId.AgentConfigs];
  const validateAgentConfigs = new Ajv().compile(agentConfigsSchema);

  it('guides settings.json users toward the object-map format', () => {
    expect(agentConfigsSchema.type).toBe('object');
    expect(agentConfigsSchema.default).toEqual({});
    expect(agentConfigsSchema.defaultSnippets).toEqual([
      {
        label: 'acp agent configs',
        description: '%preference.ai.native.agent.configs.snippet.description%',
        bodyText:
          '{\n\t"${1:custom-agent}": {\n\t\t"command": "${2:custom-agent}",\n\t\t"args": ["${3:--acp}"],\n\t\t"streaming": true,\n\t\t"description": "${4:Custom Agent}"\n\t}\n}',
      },
    ]);
    expect(agentConfigsSchema.examples).toEqual([
      {
        'custom-agent': {
          command: 'custom-agent',
          args: ['--acp'],
          streaming: true,
          description: 'Custom Agent',
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
