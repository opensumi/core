import { CodeSchemaId, IJSONSchema, localize } from '@opensumi/ide-core-browser';
export const taskSchemaUri = CodeSchemaId.tasks;

const osSpecificTaskRunnerConfiguration = {
  $ref: '#/definitions/taskRunnerConfiguration',
};

export const schema: IJSONSchema = {
  $id: taskSchemaUri,
  type: 'object',
  required: ['version'],
  properties: {
    version: {
      type: 'string',
      enum: ['2.0.0'],
      description: localize('JsonSchema.version', "The config's version number."),
    },
    windows: {
      $ref: '#/definitions/osSpecificTaskRunnerConfiguration',
      description: localize('JsonSchema.windows', 'Windows specific command configuration'),
    },
    osx: {
      $ref: '#/definitions/osSpecificTaskRunnerConfiguration',
      description: localize('JsonSchema.mac', 'Mac specific command configuration'),
    },
    linux: {
      $ref: '#/definitions/osSpecificTaskRunnerConfiguration',
      description: localize('JsonSchema.linux', 'Linux specific command configuration'),
    },
  },
  definitions: {
    showOutputType: {
      type: 'string',
      enum: ['always', 'silent', 'never'],
    },
    options: {
      type: 'object',
      description: localize('JsonSchema.options', 'Additional command options'),
      properties: {
        cwd: {
          type: 'string',
          description: localize(
            'JsonSchema.options.cwd',
            "The current working directory of the executed program or script. If omitted Code's current workspace root is used.",
          ),
        },
        env: {
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
          description: localize(
            'JsonSchema.options.env',
            "The environment of the executed program or shell. If omitted the parent process' environment is used.",
          ),
        },
      },
      additionalProperties: {
        type: ['string', 'array', 'object'],
      },
    },
    problemMatcherType: {
      oneOf: [
        {
          type: 'string',
        },
        {
          type: 'array',
          items: {
            anyOf: [
              {
                type: 'string',
              },
            ],
          },
        },
      ],
    },
    shellConfiguration: {
      type: 'object',
      additionalProperties: false,
      description: localize('JsonSchema.shellConfiguration', 'Configures the shell to be used.'),
      properties: {
        executable: {
          type: 'string',
          description: localize('JsonSchema.shell.executable', 'The shell to be used.'),
        },
        args: {
          type: 'array',
          description: localize('JsonSchema.shell.args', 'The shell arguments.'),
          items: {
            type: 'string',
          },
        },
      },
    },
    commandConfiguration: {
      type: 'object',
      additionalProperties: false,
      properties: {
        command: {
          type: 'string',
          description: localize(
            'JsonSchema.command',
            'The command to be executed. Can be an external program or a shell command.',
          ),
        },
        args: {
          type: 'array',
          description: localize('JsonSchema.tasks.args', 'Arguments passed to the command when this task is invoked.'),
          items: {
            type: 'string',
          },
        },
        options: {
          $ref: '#/definitions/options',
        },
      },
    },
    taskDescription: {
      type: 'object',
      required: ['taskName'],
      additionalProperties: false,
      properties: {
        taskName: {
          type: 'string',
          description: localize('JsonSchema.tasks.taskName', "The task's name"),
        },
        command: {
          type: 'string',
          description: localize(
            'JsonSchema.command',
            'The command to be executed. Can be an external program or a shell command.',
          ),
        },
        args: {
          type: 'array',
          description: localize('JsonSchema.tasks.args', 'Arguments passed to the command when this task is invoked.'),
          items: {
            type: 'string',
          },
        },
        options: {
          $ref: '#/definitions/options',
        },
        windows: {
          anyOf: [
            {
              $ref: '#/definitions/commandConfiguration',
              description: localize('JsonSchema.tasks.windows', 'Windows specific command configuration'),
            },
            {
              properties: {
                problemMatcher: {
                  $ref: '#/definitions/problemMatcherType',
                  description: localize(
                    'JsonSchema.tasks.matchers',
                    'The problem matcher(s) to use. Can either be a string or a problem matcher definition or an array of strings and problem matchers.',
                  ),
                },
              },
            },
          ],
        },
        osx: {
          anyOf: [
            {
              $ref: '#/definitions/commandConfiguration',
              description: localize('JsonSchema.tasks.mac', 'Mac specific command configuration'),
            },
            {
              properties: {
                problemMatcher: {
                  $ref: '#/definitions/problemMatcherType',
                  description: localize(
                    'JsonSchema.tasks.matchers',
                    'The problem matcher(s) to use. Can either be a string or a problem matcher definition or an array of strings and problem matchers.',
                  ),
                },
              },
            },
          ],
        },
        linux: {
          anyOf: [
            {
              $ref: '#/definitions/commandConfiguration',
              description: localize('JsonSchema.tasks.linux', 'Linux specific command configuration'),
            },
            {
              properties: {
                problemMatcher: {
                  $ref: '#/definitions/problemMatcherType',
                  description: localize(
                    'JsonSchema.tasks.matchers',
                    'The problem matcher(s) to use. Can either be a string or a problem matcher definition or an array of strings and problem matchers.',
                  ),
                },
              },
            },
          ],
        },
        suppressTaskName: {
          type: 'boolean',
          description: localize(
            'JsonSchema.tasks.suppressTaskName',
            'Controls whether the task name is added as an argument to the command. If omitted the globally defined value is used.',
          ),
          default: true,
        },
        showOutput: {
          $ref: '#/definitions/showOutputType',
          description: localize(
            'JsonSchema.tasks.showOutput',
            'Controls whether the output of the running task is shown or not. If omitted the globally defined value is used.',
          ),
        },
        echoCommand: {
          type: 'boolean',
          description: localize(
            'JsonSchema.echoCommand',
            'Controls whether the executed command is echoed to the output. Default is false.',
          ),
          default: true,
        },
        isWatching: {
          type: 'boolean',
          deprecationMessage: localize(
            'JsonSchema.tasks.watching.deprecation',
            'Deprecated. Use isBackground instead.',
          ),
          description: localize(
            'JsonSchema.tasks.watching',
            'Whether the executed task is kept alive and is watching the file system.',
          ),
          default: true,
        },
        isBackground: {
          type: 'boolean',
          description: localize(
            'JsonSchema.tasks.background',
            'Whether the executed task is kept alive and is running in the background.',
          ),
          default: true,
        },
        promptOnClose: {
          type: 'boolean',
          description: localize(
            'JsonSchema.tasks.promptOnClose',
            'Whether the user is prompted when VS Code closes with a running task.',
          ),
          default: false,
        },
        isBuildCommand: {
          type: 'boolean',
          description: localize('JsonSchema.tasks.build', "Maps this task to Code's default build command."),
          default: true,
        },
        isTestCommand: {
          type: 'boolean',
          description: localize('JsonSchema.tasks.test', "Maps this task to Code's default test command."),
          default: true,
        },
        problemMatcher: {
          $ref: '#/definitions/problemMatcherType',
          description: localize(
            'JsonSchema.tasks.matchers',
            'The problem matcher(s) to use. Can either be a string or a problem matcher definition or an array of strings and problem matchers.',
          ),
        },
      },
    },
    taskRunnerConfiguration: {
      type: 'object',
      required: [],
      properties: {
        command: {
          type: 'string',
          description: localize(
            'JsonSchema.command',
            'The command to be executed. Can be an external program or a shell command.',
          ),
        },
        args: {
          type: 'array',
          description: localize('JsonSchema.args', 'Additional arguments passed to the command.'),
          items: {
            type: 'string',
          },
        },
        options: {
          $ref: '#/definitions/options',
        },
        showOutput: {
          $ref: '#/definitions/showOutputType',
          description: localize(
            'JsonSchema.showOutput',
            "Controls whether the output of the running task is shown or not. If omitted 'always' is used.",
          ),
        },
        isWatching: {
          type: 'boolean',
          deprecationMessage: localize('JsonSchema.watching.deprecation', 'Deprecated. Use isBackground instead.'),
          description: localize(
            'JsonSchema.watching',
            'Whether the executed task is kept alive and is watching the file system.',
          ),
          default: true,
        },
        isBackground: {
          type: 'boolean',
          description: localize(
            'JsonSchema.background',
            'Whether the executed task is kept alive and is running in the background.',
          ),
          default: true,
        },
        promptOnClose: {
          type: 'boolean',
          description: localize(
            'JsonSchema.promptOnClose',
            'Whether the user is prompted when VS Code closes with a running background task.',
          ),
          default: false,
        },
        echoCommand: {
          type: 'boolean',
          description: localize(
            'JsonSchema.echoCommand',
            'Controls whether the executed command is echoed to the output. Default is false.',
          ),
          default: true,
        },
        suppressTaskName: {
          type: 'boolean',
          description: localize(
            'JsonSchema.suppressTaskName',
            'Controls whether the task name is added as an argument to the command. Default is false.',
          ),
          default: true,
        },
        taskSelector: {
          type: 'string',
          description: localize('JsonSchema.taskSelector', 'Prefix to indicate that an argument is task.'),
        },
        problemMatcher: {
          $ref: '#/definitions/problemMatcherType',
          description: localize(
            'JsonSchema.matchers',
            'The problem matcher(s) to use. Can either be a string or a problem matcher definition or an array of strings and problem matchers.',
          ),
        },
        tasks: {
          type: 'array',
          description: localize(
            'JsonSchema.tasks',
            'The task configurations. Usually these are enrichments of task already defined in the external task runner.',
          ),
          items: {
            type: 'object',
            $ref: '#/definitions/taskDescription',
          },
        },
      },
    },
    osSpecificTaskRunnerConfiguration,
  },
};
