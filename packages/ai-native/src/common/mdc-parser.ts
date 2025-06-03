/**
 * MDC 文件的 frontmatter 接口定义
 */
export interface IMDCFrontmatter {
  description?: string;
  globs?: string | string[];
  alwaysApply?: boolean;
  [key: string]: any;
}

/**
 * MDC 文件解析结果接口
 */
export interface IMDCParseResult {
  frontmatter: IMDCFrontmatter;
  content: string;
}

/**
 * MDC 文件内容结构
 */
export interface IMDCContent {
  frontmatter: IMDCFrontmatter;
  content: string;
}

/**
 * 解析简单的 YAML 值
 * @param value - 要解析的值字符串
 * @returns 解析后的值
 */
function parseYamlValue(value: string): any {
  const trimmed = value.trim();

  // 布尔值
  if (trimmed === 'true') {
    return true;
  }
  if (trimmed === 'false') {
    return false;
  }

  // null/undefined
  if (trimmed === 'null' || trimmed === '~' || trimmed === '') {
    return null;
  }

  // 数字
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return trimmed.includes('.') ? parseFloat(trimmed) : parseInt(trimmed, 10);
  }

  // 数组 (简单格式: [item1, item2, item3] 或 - item 格式)
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const arrayContent = trimmed.slice(1, -1).trim();
    if (!arrayContent) {
      return [];
    }
    return arrayContent.split(',').map((item) => parseYamlValue(item));
  }

  // 字符串 (移除引号)
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  // 默认作为字符串处理
  return trimmed;
}

/**
 * 按行解析 YAML frontmatter
 * @param frontmatterStr - frontmatter 字符串
 * @returns 解析后的对象
 */
function parseFrontmatterByLine(frontmatterStr: string): IMDCFrontmatter {
  const result: IMDCFrontmatter = {};
  const lines = frontmatterStr.split('\n');
  let currentKey: string | null = null;
  let arrayItems: string[] = [];
  let isInArray = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // 跳过空行和注释
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    // 检查是否是数组项 (以 - 开头)
    if (trimmedLine.startsWith('- ')) {
      if (currentKey && isInArray) {
        arrayItems.push(trimmedLine.slice(2).trim());
      }
      continue;
    }

    // 如果之前在处理数组，现在遇到新的键值对，先保存数组
    if (isInArray && currentKey) {
      result[currentKey] = arrayItems.map((item) => parseYamlValue(item));
      arrayItems = [];
      isInArray = false;
      currentKey = null;
    }

    // 解析键值对
    const colonIndex = trimmedLine.indexOf(':');
    if (colonIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, colonIndex).trim();
    const value = trimmedLine.slice(colonIndex + 1).trim();

    currentKey = key;

    if (value) {
      result[key] = parseYamlValue(value);
      isInArray = false;
    } else {
      isInArray = true;
      arrayItems = [];
    }
  }

  // 处理最后的数组
  if (isInArray && currentKey) {
    result[currentKey] = arrayItems.map((item) => parseYamlValue(item));
  }

  return result;
}

/**
 * 序列化对象为简单的 YAML 格式
 * @param obj - 要序列化的对象
 * @returns YAML 字符串
 */
function serializeToYaml(obj: any): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      lines.push(`${key}:`);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${typeof item === 'string' ? item : JSON.stringify(item)}`);
        }
      }
    } else if (typeof value === 'string') {
      // 如果字符串包含特殊字符或空格，使用引号
      if (value.includes(':') || value.includes('#') || value.includes('\n') || value.trim() !== value) {
        lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    } else {
      lines.push(`${key}: ${value}`);
    }
  }

  return lines.join('\n');
}

/**
 * 解析 .mdc 文件内容
 * @param rawContent - 原始文件内容
 * @returns 解析后的结果，包含 frontmatter 和 content
 */
export function parseMDC(rawContent: string): IMDCParseResult {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;
  const match = rawContent.match(frontmatterRegex);

  if (!match) {
    // 如果没有 frontmatter，整个内容作为 content
    return {
      frontmatter: {},
      content: rawContent.trim(),
    };
  }

  const [, frontmatterStr, content] = match;

  let frontmatter: IMDCFrontmatter = {};

  try {
    // 按行解析 YAML frontmatter
    frontmatter = parseFrontmatterByLine(frontmatterStr);
  } catch (error) {
    // 如果解析失败，返回空的 frontmatter
    frontmatter = {};
  }

  return {
    frontmatter,
    content: content.trim(),
  };
}

/**
 * 序列化 MDC 内容为字符串
 * @param mdcContent - MDC 内容对象
 * @returns 序列化后的字符串
 */
export function serializeMDC(mdcContent: IMDCContent): string {
  const { frontmatter, content } = mdcContent;

  // 如果 frontmatter 为空或没有有效内容，只返回 content
  if (!frontmatter || Object.keys(frontmatter).length === 0) {
    return content;
  }

  try {
    // 序列化 frontmatter 为 YAML
    const frontmatterStr = serializeToYaml(frontmatter);

    return `---\n${frontmatterStr}\n---\n${content}`;
  } catch (error) {
    // 如果序列化失败，只返回 content
    return content;
  }
}

/**
 * 验证 MDC frontmatter 是否有效
 * @param frontmatter - 要验证的 frontmatter 对象
 * @returns 验证结果
 */
export function validateMDCFrontmatter(frontmatter: any): frontmatter is IMDCFrontmatter {
  if (typeof frontmatter !== 'object' || frontmatter === null) {
    return false;
  }

  // 可选的字段类型检查
  if (frontmatter.description !== undefined && typeof frontmatter.description !== 'string') {
    return false;
  }

  if (frontmatter.globs !== undefined) {
    if (typeof frontmatter.globs !== 'string' && !Array.isArray(frontmatter.globs)) {
      return false;
    }
    if (Array.isArray(frontmatter.globs)) {
      if (!frontmatter.globs.every((glob: any) => typeof glob === 'string')) {
        return false;
      }
    }
  }

  if (frontmatter.alwaysApply !== undefined && typeof frontmatter.alwaysApply !== 'boolean') {
    return false;
  }

  return true;
}

/**
 * 创建默认的 MDC frontmatter
 * @returns 默认的 frontmatter 对象
 */
export function createDefaultMDCFrontmatter(): IMDCFrontmatter {
  return {
    description: '',
    globs: '',
    alwaysApply: false,
  };
}

/**
 * 更新 MDC 文件的 frontmatter
 * @param rawContent - 原始文件内容
 * @param newFrontmatter - 新的 frontmatter
 * @returns 更新后的文件内容
 */
export function updateMDCFrontmatter(rawContent: string, newFrontmatter: Partial<IMDCFrontmatter>): string {
  const parsed = parseMDC(rawContent);
  const updatedFrontmatter = { ...parsed.frontmatter, ...newFrontmatter };

  return serializeMDC({
    frontmatter: updatedFrontmatter,
    content: parsed.content,
  });
}

/**
 * 从 MDC 内容中提取纯文本内容（不包含 frontmatter）
 * @param rawContent - 原始文件内容
 * @returns 纯文本内容
 */
export function extractMDCContent(rawContent: string): string {
  const parsed = parseMDC(rawContent);
  return parsed.content;
}
