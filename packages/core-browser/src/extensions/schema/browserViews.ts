import { localize } from "@opensumi/ide-core-common";

export namespace browserViews {

  export const properties = {
    type: 'object',
    required: ['type', 'view'],
    defaultSnippets: [
      {
        label: 'type',
        bodyText: JSON.stringify({
          type: "${1:add}",
          view: [
            {
              id: "${2}"
            }
          ]
        }, null, '\t')
      },
    ],
    properties: {
      type: {
        type: 'string',
        enum: ['add', 'replace'],
      },
      view: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id'],
          defaultSnippets: [
            {
              label: '{\"id\":\"\"}',
              description: "",
              bodyText: JSON.stringify({
                id: "${3}"
              }, null, '\t')
            },
          ],
          properties: {
            id: {
              type: 'string',
              description: localize('kaitianContributes.browserViews.view.id'),
            },
            icon: {
              type: 'string',
              markdownDescription: localize('kaitianContributes.browserViews.view.icon'),
            },
            iconPath: {
              type: 'string',
              description: localize('kaitianContributes.browserViews.view.iconPath'),
            },
            title: {
              type: 'string',
              description: localize('kaitianContributes.browserViews.view.title'),
            },
            titleComponentId: {
              type: 'string',
              description: localize('kaitianContributes.browserViews.view.titleComponentId'),
            },
            expanded: {
              type: 'boolean',
              description: localize('kaitianContributes.browserViews.view.expanded'),
            }
          }
        }
      }
    }
  }

  export const schema = {
    description: localize('kaitianContributes.browserViews'),
    type: 'object',
    properties: {
      left: {
        ...properties,
        description: localize('kaitianContributes.browserViews.left')
      },
      right: {
        ...properties,
        description: localize('kaitianContributes.browserViews.right')
      },
      bottom: {
        ...properties,
        description: localize('kaitianContributes.browserViews.bottom')
      },
    }
  }
}
