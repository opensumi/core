import { IJSONSchema, localize } from '@opensumi/ide-core-common';

const snippetLabel = (obj: { [key in string]: string }, desc: string) => `${JSON.stringify(obj)}: ${desc}`;

const ToolbarButtonStatesProperties = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: localize('kaitianContributes.toolbar.actions.title'),
    },
    iconPath: {
      type: 'string',
      description: localize('kaitianContributes.toolbar.actions.iconPath'),
    },
    iconMaskMode: {
      type: 'boolean',
      description: localize('kaitianContributes.toolbar.actions.iconMaskMode'),
    },
    width: {
      type: 'number',
      description: localize('kaitianContributes.toolbar.actions.button.states.width'),
    },
    height: {
      type: 'number',
      description: localize('kaitianContributes.toolbar.actions.button.states.height'),
    },
    showTitle: {
      type: 'boolean',
      description: localize('kaitianContributes.toolbar.actions.button.states.showTitle'),
    },
    iconForeground: {
      type: 'string',
      description: localize('kaitianContributes.toolbar.actions.button.states.iconForeground'),
    },
    iconBackground: {
      type: 'string',
      description: localize('kaitianContributes.toolbar.actions.button.states.iconBackground'),
    },
    titleForeground: {
      type: 'string',
      description: localize('kaitianContributes.toolbar.actions.button.states.titleForeground'),
    },
    titleBackground: {
      type: 'string',
      description: localize('kaitianContributes.toolbar.actions.button.states.titleBackground'),
    },
    titleSize: {
      type: 'string',
      description: localize('kaitianContributes.toolbar.actions.button.states.titleSize'),
    },
    iconSize: {
      type: 'string',
      description: localize('kaitianContributes.toolbar.actions.button.states.iconSize'),
    },
    background: {
      type: 'string',
      description: localize('kaitianContributes.toolbar.actions.button.states.background'),
    },
    btnStyle: {
      type: 'string',
      description: localize('kaitianContributes.toolbar.actions.button.states.btnStyle'),
      enum: ['inline', 'button'],
    },
    btnTitleStyle: {
      type: 'string',
      description: localize('kaitianContributes.toolbar.actions.button.states.btnTitleStyle'),
      enum: ['vertical', 'horizontal'],
      enumDescriptions: [
        localize('kaitianContributes.toolbar.actions.button.states.btnTitleStyle.vertical'),
        localize('kaitianContributes.toolbar.actions.button.states.btnTitleStyle.horizontal'),
      ],
    },
  },
};

const ToolbarSelectStatesProperties = {
  type: 'object',
  properties: {
    backgroundColor: {
      type: 'string',
      description: localize('kaitianContributes.toolbar.actions.select.states.backgroundColor'),
    },
    labelForegroundColor: {
      type: 'string',
      description: localize('kaitianContributes.toolbar.actions.select.states.labelForegroundColor'),
    },
    iconForegroundColor: {
      type: 'string',
      description: localize('kaitianContributes.toolbar.actions.select.states.iconForegroundColor'),
    },
    width: {
      type: 'number',
      description: localize('kaitianContributes.toolbar.actions.select.states.width'),
    },
    minWidth: {
      type: 'number',
      description: localize('kaitianContributes.toolbar.actions.select.states.minWidth'),
    },
  },
};

export namespace toolbar {
  export const schema: IJSONSchema = {
    type: 'object',
    description: localize('kaitianContributes.toolbar'),
    properties: {
      actions: {
        type: 'array',
        markdownDescription: localize('kaitianContributes.toolbar.actions'),
        items: {
          type: 'object',
          required: ['id', 'description'],
          defaultSnippets: [
            {
              label: snippetLabel({ type: 'button' }, localize('kaitianContributes.toolbar.actions.type.button')),
              body: {
                id: '${2}',
                type: 'button',
                description: '${3}',
                title: '${4}',
                iconPath: '${5}',
              },
            },
            {
              label: snippetLabel({ type: 'select' }, localize('kaitianContributes.toolbar.actions.type.select')),
              body: {
                id: '${2}',
                type: 'select',
                description: '${3}',
                options: ['${4}'],
                defaultValue: '${5}',
              },
            },
          ],
          properties: {
            id: {
              type: 'string',
              description: localize('kaitianContributes.toolbar.actions.id'),
            },
            weight: {
              type: 'number',
              description: localize('kaitianContributes.toolbar.actions.weight'),
            },
            preferredPosition: {
              type: 'object',
              description: localize('kaitianContributes.toolbar.actions.preferredPosition'),
              properties: {
                location: {
                  type: 'string',
                  description: localize('kaitianContributes.toolbar.actions.preferredPosition.location'),
                },
                group: {
                  type: 'string',
                  description: localize('kaitianContributes.toolbar.actions.preferredPosition.group'),
                },
              },
            },
            strictPosition: {
              type: 'object',
              description: localize('kaitianContributes.toolbar.actions.strictPosition'),
              required: ['location', 'group'],
              defaultSnippets: [
                {
                  body: {
                    location: '${1}',
                    group: '${2}',
                  },
                },
              ],
              properties: {
                location: {
                  type: 'string',
                  description: localize('kaitianContributes.toolbar.actions.preferredPosition.location'),
                },
                group: {
                  type: 'string',
                  description: localize('kaitianContributes.toolbar.actions.preferredPosition.group'),
                },
              },
            },
            description: {
              type: 'string',
              description: localize('kaitianContributes.toolbar.actions.description'),
            },
            command: {
              type: 'string',
              description: localize('kaitianContributes.toolbar.actions.command'),
            },
            defaultState: {
              type: 'string',
              description: localize('kaitianContributes.toolbar.actions.defaultState'),
            },
          },
          oneOf: [
            {
              required: ['type', 'title', 'iconPath'],
              properties: {
                type: {
                  type: 'string',
                  description: localize('kaitianContributes.toolbar.actions.type'),
                  enum: ['button'],
                  enumDescriptions: [
                    localize('kaitianContributes.toolbar.actions.type.button'),
                  ],
                  default: 'button',
                },
                title: {
                  type: 'string',
                  description: localize('kaitianContributes.toolbar.actions.title'),
                },
                iconPath: {
                  type: 'string',
                  description: localize('kaitianContributes.toolbar.actions.iconPath'),
                },
                iconMaskMode: {
                  type: 'boolean',
                  description: localize('kaitianContributes.toolbar.actions.iconMaskMode'),
                },
                states: {
                  type: 'object',
                  description: localize('kaitianContributes.toolbar.actions.button.states'),
                  additionalProperties: ToolbarButtonStatesProperties,
                  properties: {
                    default: ToolbarButtonStatesProperties,
                  },
                },
                popoverComponent: {
                  type: 'string',
                  description: localize('kaitianContributes.toolbar.actions.popoverComponent'),
                },
                popoverStyle: {
                  type: 'object',
                  description: localize('kaitianContributes.toolbar.actions.popoverStyle'),
                  properties: {
                    position: {
                      type: 'string',
                      description: localize('kaitianContributes.toolbar.actions.popoverStyle.position'),
                      enum: ['top', 'bottom'],
                      enumDescriptions: [
                        localize('kaitianContributes.toolbar.actions.popoverStyle.position.top'),
                        localize('kaitianContributes.toolbar.actions.popoverStyle.position.bottom'),
                      ],
                    },
                    horizontalOffset: {
                      type: 'number',
                      description: localize('kaitianContributes.toolbar.actions.popoverStyle.horizontalOffset'),
                    },
                    hideOnClickOutside: {
                      type: 'boolean',
                      description: localize('kaitianContributes.toolbar.actions.popoverStyle.hideOnClickOutside'),
                    },
                    noContainerStyle: {
                      type: 'boolean',
                      description: localize('kaitianContributes.toolbar.actions.popoverStyle.noContainerStyle'),
                    },
                    minWidth: {
                      type: 'number',
                      description: localize('kaitianContributes.toolbar.actions.popoverStyle.minWidth'),
                    },
                    minHeight: {
                      type: 'number',
                      description: localize('kaitianContributes.toolbar.actions.popoverStyle.minHeight'),
                    },
                  },
                },
                when: {
                  type: 'string',
                  description: localize('kaitianContributes.toolbar.actions.when'),
                },
              },
            },
            {
              required: ['type', 'options', 'defaultValue'],
              properties: {
                type: {
                  type: 'string',
                  description: localize('kaitianContributes.toolbar.actions.type'),
                  enum: ['select'],
                  enumDescriptions: [
                    localize('kaitianContributes.toolbar.actions.type.select'),
                  ],
                  default: 'select',
                },
                options: {
                  type: 'array',
                  description: localize('kaitianContributes.toolbar.actions.select.options'),
                  required: ['value'],
                  items: {
                    type: 'object',
                    defaultSnippets: [
                      {
                        label: snippetLabel({ value: '' }, localize('kaitianContributes.toolbar.actions.select.options.value')),
                        body: {
                          value: '${1}',
                        },
                      },
                    ],
                    properties: {
                      iconPath: {
                        type: 'string',
                        description: localize('kaitianContributes.toolbar.actions.select.options.iconPath'),
                      },
                      iconMaskMode: {
                        type: 'boolean',
                        description: localize('kaitianContributes.toolbar.actions.select.options.iconMaskMode'),
                      },
                      label: {
                        type: 'string',
                        description: localize('kaitianContributes.toolbar.actions.select.options.label'),
                      },
                      value: {
                        type: 'string',
                        description: localize('kaitianContributes.toolbar.actions.select.options.value'),
                      },
                    },
                  },
                },
                defaultValue: {
                  type: 'string',
                  description: localize('kaitianContributes.toolbar.actions.select.defaultValue'),
                },
                optionEqualityKey: {
                  type: 'string',
                  description: localize('kaitianContributes.toolbar.actions.select.optionEqualityKey'),
                },
                states: {
                  type: 'object',
                  description: localize('kaitianContributes.toolbar.actions.select.states'),
                  additionalProperties: ToolbarSelectStatesProperties,
                },
              },
            },
          ],
        },
      },
    },
  };
}
