const SENSITIVE_ENV_PATTERN = /(token|key|secret|password|authorization|credential)/i;

export function summarizeMcpEnv(env?: Record<string, string>): Record<string, unknown> {
  const envEntries = Object.entries(env ?? {});
  const path = env?.PATH ?? env?.Path ?? env?.path;
  return {
    keys: envEntries.map(([key]) => key).sort(),
    sensitiveKeys: envEntries
      .map(([key]) => key)
      .filter((key) => SENSITIVE_ENV_PATTERN.test(key))
      .sort(),
    pathEntries: path ? path.split(':').filter(Boolean).length : 0,
    pathBytes: path ? Buffer.byteLength(path, 'utf8') : 0,
  };
}

export function summarizeMcpTools(tools: any): Record<string, unknown> {
  const toolsArray = Array.isArray(tools?.tools) ? tools.tools : [];
  const toolStats = toolsArray.map((tool) => {
    const schemaBytes = Buffer.byteLength(JSON.stringify(tool.inputSchema ?? null), 'utf8');
    const descriptionBytes = Buffer.byteLength(tool.description ?? '', 'utf8');
    return {
      name: tool.name,
      schemaBytes,
      descriptionBytes,
      totalToolBytes: Buffer.byteLength(
        JSON.stringify({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        }),
        'utf8',
      ),
    };
  });
  const largest = [...toolStats].sort((a, b) => b.totalToolBytes - a.totalToolBytes).slice(0, 5);
  return {
    toolCount: toolsArray.length,
    schemaBytes: toolStats.reduce((total, tool) => total + tool.schemaBytes, 0),
    descriptionBytes: toolStats.reduce((total, tool) => total + tool.descriptionBytes, 0),
    totalToolBytes: toolStats.reduce((total, tool) => total + tool.totalToolBytes, 0),
    largest,
  };
}
