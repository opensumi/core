import cls from 'classnames';
import * as React from 'react';

import { Popover, PopoverPosition, Select, getIcon } from '@opensumi/ide-components';
import { EnhanceIcon } from '@opensumi/ide-core-browser/lib/components/ai-native';

import styles from './mention-input.module.less';
import { MentionPanel } from './mention-panel';
import { MentionItem, MentionState } from './types';
interface MentionInputProps {
  firstLevelItems?: MentionItem[];
  secondLevelItems?: Record<string, MentionItem[]>;
  onSend?: (content: string) => void;
  placeholder?: string;
}

export const MentionInput: React.FC<MentionInputProps> = ({
  firstLevelItems = [],
  secondLevelItems = {},
  onSend,
  placeholder = '🔍 请输入要搜索的文件内容',
}) => {
  // 默认一级菜单项
  const defaultFirstLevelItems: MentionItem[] = [{ id: 'file', type: 'file', text: 'File', hasSubmenu: true }];

  // 默认二级菜单项
  const defaultSecondLevelItems: Record<string, MentionItem[]> = {
    file: [
      { id: 'file1', type: 'file', text: '文件1.js' },
      { id: 'file2', type: 'file', text: '文件2.css' },
      { id: 'file3', type: 'file', text: '文件3.html' },
      { id: 'file4', type: 'file', text: '文件4.json' },
      { id: 'file5', type: 'file', text: '文件5.ts' },
    ],
  };

  // 使用传入的菜单项或默认菜单项
  const actualFirstLevelItems = firstLevelItems.length > 0 ? firstLevelItems : defaultFirstLevelItems;
  const actualSecondLevelItems = Object.keys(secondLevelItems).length > 0 ? secondLevelItems : defaultSecondLevelItems;

  const editorRef = React.useRef<HTMLDivElement>(null);
  const [mentionState, setMentionState] = React.useState<MentionState>({
    active: false,
    startPos: null,
    filter: '',
    position: { top: 0, left: 0 },
    activeIndex: 0,
    level: 0, // 0: 一级菜单, 1: 二级菜单
    parentType: null, // 二级菜单的父类型
    secondLevelFilter: '', // 二级菜单的筛选文本
    inlineSearchActive: false, // 是否在输入框中进行二级搜索
    inlineSearchStartPos: null, // 内联搜索的起始位置
  });

  // 获取当前菜单项
  const getCurrentItems = (): MentionItem[] => {
    if (mentionState.level === 0) {
      return actualFirstLevelItems;
    } else {
      return mentionState.parentType && actualSecondLevelItems[mentionState.parentType]
        ? actualSecondLevelItems[mentionState.parentType]
        : [];
    }
  };

  // 获取光标位置
  const getCursorPosition = (element: HTMLElement): number => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      return 0;
    }

    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
  };

  // 处理输入事件
  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !editorRef.current) {
      return;
    }

    const range = selection.getRangeAt(0);
    const text = editorRef.current.textContent || '';
    const cursorPos = getCursorPosition(editorRef.current);

    // 判断是否刚输入了 @
    if (text[cursorPos - 1] === '@' && !mentionState.active && !mentionState.inlineSearchActive) {
      // 获取 @ 符号在视窗中的位置
      const rect = range.getBoundingClientRect();

      setMentionState({
        active: true,
        startPos: cursorPos,
        filter: '@',
        position: {
          // 使用 window 绝对位置以配合 fixed 定位
          top: rect.bottom + window.scrollY + 5,
          left: rect.left + window.scrollX,
        },
        activeIndex: 0,
        level: 0,
        parentType: null,
        secondLevelFilter: '',
        inlineSearchActive: false,
        inlineSearchStartPos: null,
      });
    }

    // 如果已激活提及面板且在一级菜单，更新过滤内容
    if (mentionState.active && mentionState.level === 0 && mentionState.startPos !== null) {
      if (cursorPos < mentionState.startPos) {
        // 如果光标移到了 @ 之前，关闭面板
        setMentionState((prev) => ({ ...prev, active: false }));
      } else {
        const newFilter = text.substring(mentionState.startPos - 1, cursorPos);
        setMentionState((prev) => ({
          ...prev,
          filter: newFilter,
          activeIndex: 0,
        }));
      }
    }

    // 如果在输入框中进行二级搜索
    if (mentionState.inlineSearchActive && mentionState.inlineSearchStartPos !== null) {
      // 检查光标是否在 @file: 之后
      const filePrefix = '@file:';
      const prefixPos = mentionState.inlineSearchStartPos - filePrefix.length;

      if (prefixPos >= 0 && cursorPos > prefixPos + filePrefix.length) {
        // 提取搜索文本
        const searchText = text.substring(prefixPos + filePrefix.length, cursorPos);

        // 更新搜索文本和面板位置
        setMentionState((prev) => ({
          ...prev,
          secondLevelFilter: searchText,
          active: true,
          position: {
            top: range.getBoundingClientRect().bottom + window.scrollY + 5,
            left: range.getBoundingClientRect().left + window.scrollX,
          },
          activeIndex: 0,
        }));
      } else if (cursorPos <= prefixPos) {
        // 如果光标移到了 @file: 之前，关闭内联搜索
        setMentionState((prev) => ({
          ...prev,
          inlineSearchActive: false,
          active: false,
        }));
      }
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // 如果按下ESC键且提及面板处于活动状态或内联搜索处于活动状态
    if (e.key === 'Escape' && (mentionState.active || mentionState.inlineSearchActive)) {
      // 如果在二级菜单，返回一级菜单
      if (mentionState.level > 0) {
        setMentionState((prev) => ({
          ...prev,
          level: 0,
          activeIndex: 0,
          secondLevelFilter: '',
          inlineSearchActive: false,
        }));
      } else {
        // 如果在一级菜单，完全关闭面板
        setMentionState((prev) => ({
          ...prev,
          active: false,
          inlineSearchActive: false,
        }));
      }
      e.preventDefault();
      return;
    }

    // 如果提及面板未激活，不处理其他键盘事件
    if (!mentionState.active) {
      return;
    }

    // 获取当前过滤后的项目
    let filteredItems = getCurrentItems();
    const filter = mentionState.level === 0 ? mentionState.filter : mentionState.secondLevelFilter;

    if (mentionState.level === 0) {
      // 一级菜单过滤
      if (filter && filter.length > 1) {
        const searchText = filter.substring(1).toLowerCase();
        filteredItems = filteredItems.filter((item) => item.text.toLowerCase().includes(searchText));
      }
    } else {
      // 二级菜单过滤
      if (filter && filter.length > 0) {
        filteredItems = filteredItems.filter((item) => item.text.toLowerCase().includes(filter.toLowerCase()));
      }
    }

    if (filteredItems.length === 0) {
      return;
    }

    if (e.key === 'ArrowDown') {
      // 向下导航
      setMentionState((prev) => ({
        ...prev,
        activeIndex: (prev.activeIndex + 1) % filteredItems.length,
      }));
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      // 向上导航
      setMentionState((prev) => ({
        ...prev,
        activeIndex: (prev.activeIndex - 1 + filteredItems.length) % filteredItems.length,
      }));
      e.preventDefault();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      // 确认选择
      if (filteredItems.length > 0) {
        handleSelectItem(filteredItems[mentionState.activeIndex]);
        e.preventDefault();
      }
    }
  };

  // 处理返回上一级
  const handleBackToParent = () => {
    setMentionState((prev) => ({
      ...prev,
      level: 0,
      activeIndex: 0,
      secondLevelFilter: '',
      inlineSearchActive: false,
    }));
  };

  // 处理点击事件
  const handleDocumentClick = (e: MouseEvent) => {
    if (
      mentionState.active &&
      editorRef.current &&
      !editorRef.current.contains(e.target as Node) &&
      !document.querySelector('.mention-panel')?.contains(e.target as Node)
    ) {
      setMentionState((prev) => ({
        ...prev,
        active: false,
        inlineSearchActive: false,
      }));
    }
  };

  // 添加和移除全局点击事件监听器
  React.useEffect(() => {
    document.addEventListener('click', handleDocumentClick);

    // 添加滚动事件监听，确保面板跟随滚动
    const handleScroll = () => {
      if (mentionState.active) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();

          setMentionState((prev) => ({
            ...prev,
            position: {
              top: rect.bottom + window.scrollY + 5,
              left: rect.left + window.scrollX,
            },
          }));
        }
      }
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      document.removeEventListener('click', handleDocumentClick);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [mentionState.active]);

  // 选择提及项目
  const handleSelectItem = (item: MentionItem) => {
    if (!editorRef.current) {
      return;
    }

    // 如果项目有子菜单，进入二级菜单
    if (item.hasSubmenu) {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) {
        return;
      }

      const range = selection.getRangeAt(0);
      const cursorPos = getCursorPosition(editorRef.current);

      // 如果是从一级菜单选择了 file 类型
      if (mentionState.level === 0 && item.type === 'file' && mentionState.startPos !== null) {
        // 创建一个文本节点 "@file:"
        const filePrefix = document.createTextNode('@file:');

        // 删除 @ 符号及后面可能输入的内容
        const tempRange = document.createRange();
        tempRange.setStart(range.startContainer, mentionState.startPos - 1);
        tempRange.setEnd(range.startContainer, cursorPos);
        tempRange.deleteContents();

        // 插入 "@file:"
        tempRange.insertNode(filePrefix);

        // 将光标移到 "@file:" 后面
        const newRange = document.createRange();
        newRange.setStartAfter(filePrefix);
        newRange.setEndAfter(filePrefix);
        selection.removeAllRanges();
        selection.addRange(newRange);

        // 激活内联搜索模式
        setMentionState((prev) => ({
          ...prev,
          active: true,
          level: 1,
          parentType: 'file',
          inlineSearchActive: true,
          inlineSearchStartPos: getCursorPosition(editorRef.current as HTMLElement),
          secondLevelFilter: '',
          activeIndex: 0,
          position: {
            top: range.getBoundingClientRect().bottom + window.scrollY + 5,
            left: range.getBoundingClientRect().left + window.scrollX,
          },
        }));

        editorRef.current.focus();
        return;
      }

      return;
    }

    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      return;
    }

    const cursorPos = getCursorPosition(editorRef.current);

    // 如果是在内联搜索模式下选择文件
    if (
      mentionState.inlineSearchActive &&
      mentionState.parentType === 'file' &&
      mentionState.inlineSearchStartPos !== null
    ) {
      // 找到 @file: 的位置
      const filePrefix = '@file:';
      const prefixPos = mentionState.inlineSearchStartPos - filePrefix.length;

      if (prefixPos >= 0) {
        // 创建一个带样式的提及标签
        const mentionTag = document.createElement('span');
        mentionTag.className = styles.mention_tag;
        mentionTag.dataset.id = item.id;
        mentionTag.dataset.type = item.type;
        mentionTag.contentEditable = 'false';
        mentionTag.textContent = '@' + item.text;

        // 创建一个范围从 @file: 开始到当前光标
        const tempRange = document.createRange();

        // 定位到 @file: 的位置
        let charIndex = 0;
        let foundStart = false;
        const textNodes: Array<{ node: Node; start: number; end: number }> = [];

        function findPosition(node: Node) {
          if (node.nodeType === 3) {
            // 文本节点
            textNodes.push({
              node,
              start: charIndex,
              end: charIndex + node.textContent!.length,
            });
            charIndex += node.textContent!.length;
          } else if (node.nodeType === 1) {
            // 元素节点
            const children = node.childNodes || [];
            for (const child of Array.from(children)) {
              findPosition(child);
            }
          }
        }

        findPosition(editorRef.current);

        for (const textNode of textNodes) {
          if (prefixPos >= textNode.start && prefixPos <= textNode.end) {
            const startOffset = prefixPos - textNode.start;
            tempRange.setStart(textNode.node, startOffset);
            foundStart = true;
          }

          if (foundStart && cursorPos >= textNode.start && cursorPos <= textNode.end) {
            const endOffset = cursorPos - textNode.start;
            tempRange.setEnd(textNode.node, endOffset);
            break;
          }
        }

        if (foundStart) {
          tempRange.deleteContents();
          tempRange.insertNode(mentionTag);

          // 将光标移到提及标签后面
          const newRange = document.createRange();
          newRange.setStartAfter(mentionTag);
          newRange.setEndAfter(mentionTag);
          selection.removeAllRanges();
          selection.addRange(newRange);

          // 添加一个空格
          const spaceNode = document.createTextNode(' ');
          newRange.insertNode(spaceNode);
          newRange.setStartAfter(spaceNode);
          newRange.setEndAfter(spaceNode);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }

        setMentionState((prev) => ({
          ...prev,
          active: false,
          inlineSearchActive: false,
        }));
        editorRef.current.focus();
        return;
      }
    }

    // 原有的处理逻辑（用于非内联搜索情况）
    // 创建一个带样式的提及标签
    const mentionTag = document.createElement('span');
    mentionTag.className = styles.mention_tag;
    mentionTag.dataset.id = item.id;
    mentionTag.dataset.type = item.type;
    mentionTag.contentEditable = 'false';
    mentionTag.textContent = '@' + item.text;

    // 定位到 @ 符号的位置
    let charIndex = 0;
    let foundStart = false;
    const textNodes: Array<{ node: Node; start: number; end: number }> = [];

    function findPosition(node: Node) {
      if (node.nodeType === 3) {
        // 文本节点
        textNodes.push({
          node,
          start: charIndex,
          end: charIndex + node.textContent!.length,
        });
        charIndex += node.textContent!.length;
      } else if (node.nodeType === 1) {
        // 元素节点
        const children = node.childNodes;
        for (const child of Array.from(children)) {
          findPosition(child);
        }
      }
    }

    findPosition(editorRef.current);

    const tempRange = document.createRange();

    if (mentionState.startPos !== null) {
      for (const textNode of textNodes) {
        if (mentionState.startPos - 1 >= textNode.start && mentionState.startPos - 1 <= textNode.end) {
          const startOffset = mentionState.startPos - 1 - textNode.start;
          tempRange.setStart(textNode.node, startOffset);
          foundStart = true;
        }

        if (foundStart && cursorPos >= textNode.start && cursorPos <= textNode.end) {
          const endOffset = cursorPos - textNode.start;
          tempRange.setEnd(textNode.node, endOffset);
          break;
        }
      }
    }

    if (foundStart) {
      tempRange.deleteContents();
      tempRange.insertNode(mentionTag);

      // 将光标移到提及标签后面
      const newRange = document.createRange();
      newRange.setStartAfter(mentionTag);
      newRange.setEndAfter(mentionTag);
      selection.removeAllRanges();
      selection.addRange(newRange);

      // 添加一个空格
      const spaceNode = document.createTextNode(' ');
      newRange.insertNode(spaceNode);
      newRange.setStartAfter(spaceNode);
      newRange.setEndAfter(spaceNode);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }

    setMentionState((prev) => ({ ...prev, active: false }));
    editorRef.current.focus();
  };

  // 发送消息
  const handleSend = () => {
    if (!editorRef.current) {
      return;
    }

    const content = editorRef.current.innerHTML;

    if (onSend) {
      onSend(content);
    } else {
      // 默认行为
      alert('已发送消息！内容已记录到控制台。');
    }

    editorRef.current.innerHTML = '';
  };

  return (
    <div className={styles.input_container}>
      <div className={styles.editor_area}>
        <div
          ref={editorRef}
          className={styles.editor}
          contentEditable={true}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
        />

        <MentionPanel
          items={getCurrentItems()}
          activeIndex={mentionState.activeIndex}
          onSelectItem={handleSelectItem}
          onBackToParent={handleBackToParent}
          position={mentionState.position}
          filter={mentionState.level === 0 ? mentionState.filter : mentionState.secondLevelFilter}
          visible={mentionState.active}
          level={mentionState.level}
          parentType={mentionState.parentType}
        />
      </div>
      <div className={styles.footer}>
        <Select
          options={[
            { label: 'Claude 3.5 Sonnet (外部模型)', value: 'Claude 3.5 Sonnet (外部模型)' },
            { label: 'Claude 3.5 Sonnet (内部模型)', value: 'Claude 3.5 Sonnet (内部模型)' },
          ]}
          value={'Claude 3.5 Sonnet (外部模型)'}
          className={styles.model_selector}
          size='small'
        />
        <Popover
          overlayClassName={styles.popover_icon}
          id={'ai-chat-header-mcp-server'}
          position={PopoverPosition.top}
          title={'MCP Server'}
        >
          <EnhanceIcon
            className={cls(getIcon('mcp'), styles.mcp_logo)}
            // onClick={handleShowMCPConfig}
            tabIndex={0}
            role='button'
            ariaLabel={'MCP Server'}
          />
        </Popover>
      </div>
    </div>
  );
};
