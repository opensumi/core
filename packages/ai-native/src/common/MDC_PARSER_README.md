# MDC 文件解析器

MDC (Markdown with YAML Frontmatter) 解析器用于解析和序列化带有 YAML frontmatter 的 Markdown 文件。

## 文件格式

MDC 文件格式如下：

```
---
description:
globs:
alwaysApply: false
---
icejs is a react-like framework
```

其中：

- `---` 分隔符之间的部分是 YAML frontmatter
- 分隔符之后的部分是 Markdown 内容

## API 接口

### 类型定义

```typescript
interface IMDCFrontmatter {
  description?: string;
  globs?: string | string[];
  alwaysApply?: boolean;
  [key: string]: any;
}

interface IMDCParseResult {
  frontmatter: IMDCFrontmatter;
  content: string;
}

interface IMDCContent {
  frontmatter: IMDCFrontmatter;
  content: string;
}
```

### 主要函数

#### `parseMDC(rawContent: string): IMDCParseResult`

解析 MDC 文件内容，返回解析后的 frontmatter 和内容。

**示例：**

```typescript
const content = `---
description: "React规则"
globs: ["*.tsx", "*.jsx"]
alwaysApply: true
---
使用React hooks和函数组件`;

const result = parseMDC(content);
// result.frontmatter = { description: "React规则", globs: ["*.tsx", "*.jsx"], alwaysApply: true }
// result.content = "使用React hooks和函数组件"
```

#### `serializeMDC(mdcContent: IMDCContent): string`

将 MDC 内容对象序列化为字符串格式。

**示例：**

```typescript
const mdcContent = {
  frontmatter: {
    description: 'TypeScript规则',
    globs: ['*.ts'],
    alwaysApply: false,
  },
  content: '使用严格的类型检查',
};

const serialized = serializeMDC(mdcContent);
// 输出:
// ---
// description: TypeScript规则
// globs:
//   - "*.ts"
// alwaysApply: false
// ---
// 使用严格的类型检查
```

#### `updateMDCFrontmatter(rawContent: string, newFrontmatter: Partial<IMDCFrontmatter>): string`

更新现有 MDC 内容的 frontmatter。

**示例：**

```typescript
const original = `---
description: 
alwaysApply: false
---
原始内容`;

const updated = updateMDCFrontmatter(original, {
  description: '更新后的描述',
  globs: ['*.js'],
});
// 更新 frontmatter，保持原始内容不变
```

#### `extractMDCContent(rawContent: string): string`

从 MDC 内容中提取纯文本内容（不包含 frontmatter）。

**示例：**

```typescript
const content = extractMDCContent(mdcContent);
// 只返回 Markdown 内容部分
```

#### `validateMDCFrontmatter(frontmatter: any): boolean`

验证 frontmatter 对象是否符合规范。

#### `createDefaultMDCFrontmatter(): IMDCFrontmatter`

创建默认的 frontmatter 对象。

## 在 RulesService 中的使用

`RulesService` 类已经集成了 MDC 解析功能：

```typescript
// 解析全局规则
const mdcRules = rulesService.parseGlobalRulesAsMDC();
if (mdcRules) {
  console.log('规则描述:', mdcRules.frontmatter.description);
  console.log('适用文件:', mdcRules.frontmatter.globs);
  console.log('规则内容:', mdcRules.content);
}

// 更新全局规则
const newMDCContent = {
  frontmatter: {
    description: '新的编码规范',
    globs: ['src/**/*.ts'],
    alwaysApply: true,
  },
  content: '遵循 TypeScript 最佳实践',
};
rulesService.updateGlobalRulesWithMDC(newMDCContent);
```

## 错误处理

解析器对错误具有良好的容错性：

- 如果 YAML frontmatter 格式错误，将返回空的 frontmatter 对象
- 如果没有 frontmatter，整个内容将作为 content 返回
- 序列化失败时，只返回内容部分

## 注意事项

1. frontmatter 中的 `globs` 字段可以是字符串或字符串数组
2. 所有 frontmatter 字段都是可选的
3. frontmatter 支持扩展，可以包含任意额外字段
4. 内容部分会自动去除首尾空白字符
