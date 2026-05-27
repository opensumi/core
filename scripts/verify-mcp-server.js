#!/usr/bin/env node
'use strict';

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

const server = new Server(
  {
    name: 'opensumi-acp-verify-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'verify_echo',
      description: 'Echo a message back. Use this to verify that the OpenSumi ACP MCP bridge can call tools.',
      inputSchema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Message to echo.',
          },
        },
        required: ['message'],
        additionalProperties: false,
      },
    },
    {
      name: 'verify_workspace',
      description: 'Return the MCP server process cwd and selected environment values for verification.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  if (name === 'verify_echo') {
    return {
      content: [
        {
          type: 'text',
          text: `echo:${String(args.message ?? '')}`,
        },
      ],
    };
  }

  if (name === 'verify_workspace') {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            cwd: process.cwd(),
            verifyEnv: process.env.OPENSUMI_MCP_VERIFY || '',
          }),
        },
      ],
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: `Unknown tool: ${name}`,
      },
    ],
    isError: true,
  };
});

server.connect(new StdioServerTransport()).catch((error) => {
  console.error(error);
  process.exit(1);
});
