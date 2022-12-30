# Changelog

> For some reason, in v2.x.y version, there may also be a Break Change in the x-bit.

## History

- [Previous Changelogs](https://github.com/opensumi/core/releases)
- [Previous Breaking Changes](https://github.com/opensumi/core/wiki/Breaking-Changes)

## v2.22.0 [Pre-release]

<a name="breaking_changes_2.22.0">[Breaking Changes:](#breaking_changes_2.22.0)</a>

#### 1. The `ClientApp` is no longer exported by `@opensumi/ide-core-browser`

We have removed the default export of `bootstrap/app.ts` in `@opensumi/ide-core-browser`. The `@opensumi/monaco-editor-core` in app.ts will cause a lot of memory leaks in the test code.

```diff
- import { ClientApp } from '@opensumi/ide-core-browser';
// Change to
+ import { ClientApp } from '@opensumi/ide-core-browser/lib/bootstrap/app';
```

#### 2. The `@opensumi/ide-userstorage` module has been permanently removed

If used, please remove this module, it has no practical effect.

#### 3. The `Scroll` component was removed

Please use `Scollerbars` component instead.

#### 4. The `DeprecatedRecycleTree` component was removed

Please use `RecycleTree` or `BasicRecycleTree` component instead.

## v2.21.0

### What's New Features

- feat: improve workspaceService initialize speed by @life2015 in https://github.com/opensumi/core/pull/1824
- feat: support debug exception widget by @Ricbet in https://github.com/opensumi/core/pull/1828
- feat: improve bootstrap performance by @Aaaaash in https://github.com/opensumi/core/pull/1772
- feat: update watch exclude rule by @life2015 in https://github.com/opensumi/core/pull/1879
- feat: implement comment timestamp by @hacke2 in https://github.com/opensumi/core/pull/1595
- feat: terminal use webgl renderer by @Aaaaash in https://github.com/opensumi/core/pull/1653
- feat: implement InputBoxValidationMessage and InputBoxValidationSeverity by @hacke2 in https://github.com/opensumi/core/pull/1593
- feat: create files with options take the content by @samyzh in https://github.com/opensumi/core/pull/1648
- feat: support navigate editor history by mouse 3/4 by @erha19 in https://github.com/opensumi/core/pull/1663
- feat: support multi-person collaborative editing by @situ2001 in https://github.com/opensumi/core/pull/1274
- feat: Implementation of cross-end and cross-window file system service by @songhn233 in https://github.com/opensumi/core/pull/1594
- feat: capture Electron IPC messages for opensumi devtools by @tyn1998 in https://github.com/opensumi/core/pull/1583
- feat: support setting json glyphmargin edit by @Ricbet in https://github.com/opensumi/core/pull/1722
- feat: support quickopen render codicons by @Ricbet in https://github.com/opensumi/core/pull/1704
- feat: custom electron headerbar title compoment by @yantze in https://github.com/opensumi/core/pull/1730
- feat: implement quickpick kind api by @hacke2 in https://github.com/opensumi/core/pull/1673
- feat: support TreeView Drag API by @erha19 in https://github.com/opensumi/core/pull/1764
- feat: support move editor tabs over the tabbar by @erha19 in https://github.com/opensumi/core/pull/1671
- feat: support more menus on filetree filter mode by @erha19 in https://github.com/opensumi/core/pull/1785
- feat: support Git actionButton and improve style by @erha19 in https://github.com/opensumi/core/pull/1702
- feat: support set window title by @bytemain in https://github.com/opensumi/core/pull/1767
- feat: intranet resource config by @Ricbet in https://github.com/opensumi/core/pull/1808
- feat: migrate walk through snippets provider to file-scheme module by @Aaaaash in https://github.com/opensumi/core/pull/1340
- feat: support macos native dirty indicator by @bytemain in https://github.com/opensumi/core/pull/1773
- feat: update high contrast theme by @AhkunTa in https://github.com/opensumi/core/pull/1728

### Refactor

- refactor: parallel open resource by @Aaaaash in https://github.com/opensumi/core/pull/1873
- refactor: initialize the file tree without repetition by @Aaaaash in https://github.com/opensumi/core/pull/1874
- refactor: delay some time-consuming operations by @Aaaaash in https://github.com/opensumi/core/pull/1872
- refactor: optimize ajv load order by @yantze in https://github.com/opensumi/core/pull/1607
- refactor: add missing type for `file-service` by @situ2001 in https://github.com/opensumi/core/pull/1611

### Style Changes

- style: put resize handle hover line to the top by @erha19 in https://github.com/opensumi/core/pull/1852

### Other Changes

- fix: startup utils typo by @Ricbet in https://github.com/opensumi/core/pull/1685
- fix: revealInSideBar invalid by @Ricbet in https://github.com/opensumi/core/pull/1682
- fix: only handle scheme `file` on collaborative mode by @situ2001 in https://github.com/opensumi/core/pull/1709
- fix: change statusbar view when tooltip updated by @hacke2 in https://github.com/opensumi/core/pull/1712
- fix: recover deleted input selection style by @hacke2 in https://github.com/opensumi/core/pull/1719
- fix: file tree input validateMessage not hide by @Ricbet in https://github.com/opensumi/core/pull/1715
- fix: select option style in light mode by @hacke2 in https://github.com/opensumi/core/pull/1727
- fix: localEcho exclude program config type defense by @life2015 in https://github.com/opensumi/core/pull/1800
- fix: unified menubar background color by @bytemain in https://github.com/opensumi/core/pull/1812
- fix: run SCM actions with selected repo by @erha19 in https://github.com/opensumi/core/pull/1810
- fix: setDocumentEdited only in electron by @bytemain in https://github.com/opensumi/core/pull/1806
- fix: get correct unsaved files number by @erha19 in https://github.com/opensumi/core/pull/1827
- fix: support smart commit with 1.69.0 git extension by @erha19 in https://github.com/opensumi/core/pull/1805
- fix(search): arrow up key doesn't trigger search by @bytemain in https://github.com/opensumi/core/pull/1774
- fix: the preference markdown display with placeholder by @yantze in https://github.com/opensumi/core/pull/1854
- fix: improve extension installing UX and support unstall by @erha19 in https://github.com/opensumi/core/pull/1855
- fix: debug statck frame not update on the first stoped by @erha19 in https://github.com/opensumi/core/pull/1859
- fix: some event should not be dispose while switch session by @erha19 in https://github.com/opensumi/core/pull/1866
- fix: submenus show/hide rule by @Ricbet in https://github.com/opensumi/core/pull/1875
- fix: submenus error by @Aaaaash in https://github.com/opensumi/core/pull/1867
- test: implement run debug e2e test case by @Ricbet in https://github.com/opensumi/core/pull/1787
- test: add keymaps e2e test by @erha19 in https://github.com/opensumi/core/pull/1850
- test: get correct git decoration on filetree by @erha19 in https://github.com/opensumi/core/pull/1834
- test: filter files on the filetree by @erha19 in https://github.com/opensumi/core/pull/1835
- test: implement go to defination by cmd click by @Ricbet in https://github.com/opensumi/core/pull/1786
- test: add opened editor e2e test by @erha19 in https://github.com/opensumi/core/pull/1863
- test: improve e2e test stability and add terminal test case by @erha19 in https://github.com/opensumi/core/pull/1710
- test: add close all tabs test case by @Ricbet in https://github.com/opensumi/core/pull/1758
- test: implement file tree automatic location test case by @Ricbet in https://github.com/opensumi/core/pull/1765
- test: new file/folder from toolbar by @erha19 in https://github.com/opensumi/core/pull/1775
- chore: change filetree context menu order by @erha19 in https://github.com/opensumi/core/pull/1868
- chore(release): v2.20.10 by @erha19 in https://github.com/opensumi/core/pull/1876
- chore: add ui test retry times by @erha19 in https://github.com/opensumi/core/pull/1813
- chore(release): v2.20.7 by @erha19 in https://github.com/opensumi/core/pull/1815
- chore(release): v2.20.8 by @erha19 in https://github.com/opensumi/core/pull/1819
- chore: use GitHub release and auto labeled prs by @erha19 in https://github.com/opensumi/core/pull/1820
- chore: fix unstalable e2e test case by @erha19 in https://github.com/opensumi/core/pull/1825
- chore: fix decoration unit test by @erha19 in https://github.com/opensumi/core/pull/1823
- chore: update layout ids by @erha19 in https://github.com/opensumi/core/pull/1826
- chore(release): v2.20.9 by @Ricbet in https://github.com/opensumi/core/pull/1857
- chore: remove activityBar badge border by @yantze in https://github.com/opensumi/core/pull/1856
- chore: fix some commands i18n text by @erha19 in https://github.com/opensumi/core/pull/1847
- chore: update labels regex by @erha19 in https://github.com/opensumi/core/pull/1832
- chore: improve append view performance by @Aaaaash in https://github.com/opensumi/core/pull/1871
- chore: update view quick open prefix by @erha19 in https://github.com/opensumi/core/pull/1869
- chore: add issue labeled action by @erha19 in https://github.com/opensumi/core/pull/1781
- chore: update issue template labels by @erha19 in https://github.com/opensumi/core/pull/1793
- chore: broken actions while catching failure by @erha19 in https://github.com/opensumi/core/pull/1789
- chore: fix @opensumi/ide-collaboration module build by @erha19 in https://github.com/opensumi/core/pull/1699
- chore: improve terminal tab title by @Ricbet in https://github.com/opensumi/core/pull/1705
- chore: empty workspace notebook API implementation by @erha19 in https://github.com/opensumi/core/pull/1677
- ci: update actions by @bytemain in https://github.com/opensumi/core/pull/1776
- chore: remove useless component declaration by @erha19 in https://github.com/opensumi/core/pull/1782
- build: fix build by @bytemain in https://github.com/opensumi/core/pull/1759

<a name="breaking_changes_2.21.0">[Breaking Changes:](#breaking_changes_2.21.0)</a>

This version have not breaking changes.
