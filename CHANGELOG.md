# Changelog

> For some reason, in v2.x.y version, there may also be a Break Change in the x-bit.

## History

- [Previous Changelogs](https://github.com/opensumi/core/releases)
- [Previous Breaking Changes](https://github.com/opensumi/core/wiki/Breaking-Changes)

## [Pre-release] v2.23.0

<a name="breaking_changes_2.23.0">[Breaking Changes:](#breaking_changes_2.23.0)</a>

#### 1. Remove some useless built-in icons [#2204](https://github.com/opensumi/core/pull/2204)

This version we remove some useless filled icons on the framework and use outlined icons on the Tree Component.

- `warning-circle-fill`
- `ubuntu`
- `time-circle-fill`
- `minus-circle-fill`
- `kaitian`
- `huoban-blue`
- `huoban`
- `folder-open-fill`
- `folder-open`
- `folder-fill`
- `execute`
- `control-fill`
- `dashboard-fill`
- `compass-fill`
- `codelibrary-fill`
- `check-square-fill`
- `bulb-fill`
- `basement-fileicon`
- `basement`
- `anymock`
- `LinkE`

## v2.22.0

### What's New Features

- feat: implement TestController refreshHandler API by @Ricbet in https://github.com/opensumi/core/pull/1865
- feat: implement test item sort text api by @Ricbet in https://github.com/opensumi/core/pull/1877
- feat: support icons contribution point by @Aaaaash in https://github.com/opensumi/core/pull/1880
- feat: improve file search results order by @erha19 in https://github.com/opensumi/core/pull/1895
- feat: trigger editor find widget when no actived element by @Aaaaash in https://github.com/opensumi/core/pull/1980
- feat: support opentrs extension marketplace by @bk1012 in https://github.com/opensumi/core/pull/1933
- feat: support useVSCodeWorkspaceConfiguration config by @erha19 in https://github.com/opensumi/core/pull/1974
- feat: support more ActionButton icon expression by @erha19 in https://github.com/opensumi/core/pull/1986
- feat: support detect configuration change from the parent directory by @erha19 in https://github.com/opensumi/core/pull/1976
- feat: improve dirty diff by @Aaaaash in https://github.com/opensumi/core/pull/1978
- feat: support base64 icon on editor glyphMargin and treeview by @erha19 in https://github.com/opensumi/core/pull/2010
- feat: implement walkthroughs contribution API by @Ricbet in https://github.com/opensumi/core/pull/1902
- feat: diagnostic support display code href by @bytemain in https://github.com/opensumi/core/pull/2056
- feat: support submenus on editor/title by @erha19 in https://github.com/opensumi/core/pull/2088
- feat: optimize editor update content logic by @life2015 in https://github.com/opensumi/core/pull/2097
- feat: improve preference panel by @bytemain in https://github.com/opensumi/core/pull/2089
- feat: support markers status by @bytemain in https://github.com/opensumi/core/pull/2112
- feat: support space keybinding on file tree by @erha19 in https://github.com/opensumi/core/pull/2119
- feat: support toggle terminal keybinding by @erha19 in https://github.com/opensumi/core/pull/2130
- feat: improve file search path on workspace folders by @erha19 in https://github.com/opensumi/core/pull/2129
- feat: enable editor minimap by default by @Aaaaash in https://github.com/opensumi/core/pull/2127
- feat: implement 3-way prototyping code by @Ricbet in https://github.com/opensumi/core/pull/1960
- feat: support search and replace value by regexp by @erha19 in https://github.com/opensumi/core/pull/2138
- feat: update marketplace address by @bk1012 in https://github.com/opensumi/core/pull/2157
- feat: register debug editor decoration type when the browser is idle by @erha19 in https://github.com/opensumi/core/pull/2160
- feat: support get valid preference from service by @erha19 in https://github.com/opensumi/core/pull/2176
- feat: add more image types by @bytemain in https://github.com/opensumi/core/pull/2177
- feat: upgrade @parcel/watcher to support glob expression by @erha19 in https://github.com/opensumi/core/pull/2180
- feat(status-bar): do not display info icon if there is no info by @bytemain in https://github.com/opensumi/core/pull/2182
- feat: get file type by mime by @bytemain in https://github.com/opensumi/core/pull/2189

### Refactor

- refactor: remove package vscode-languageserver-protocol by @yantze in https://github.com/opensumi/core/pull/1988
- refactor: optimize scoped storage bootstrap speed by @erha19 in https://github.com/opensumi/core/pull/1997
- refactor: optimize bundle size of lite web ide by @erha19 in https://github.com/opensumi/core/pull/1953
- refactor: upgrade typescript version to 4.9.+ by @erha19 in https://github.com/opensumi/core/pull/1996
- refactor: remove scroll components by @erha19 in https://github.com/opensumi/core/pull/2093
- refactor: replace DeprecatedRecycleTree on the markers module by @erha19 in https://github.com/opensumi/core/pull/2099
- refactor: replace DeprecatedRecycleTree on Search view by @erha19 in https://github.com/opensumi/core/pull/2102
- refactor: remove DeprecatedRecycleTree on comment module by @erha19 in https://github.com/opensumi/core/pull/2109
- refactor: progressbar component by @Aaaaash in https://github.com/opensumi/core/pull/2114
- refactor: remove DeprecatedRecycleTree component by @erha19 in https://github.com/opensumi/core/pull/2111

### Style Changes

- style: improve debug toolbar z-index style by @erha19 in https://github.com/opensumi/core/pull/1965
- style: improve SCM delete decoration style by @erha19 in https://github.com/opensumi/core/pull/1963
- chore: improve image preview editor style by @Aaaaash in https://github.com/opensumi/core/pull/2020
- style: improve empty editor component style by @erha19 in https://github.com/opensumi/core/pull/2121
- fix: debug condition breakpoint style by @Ricbet in https://github.com/opensumi/core/pull/2141
- style: improve button overflow style by @erha19 in https://github.com/opensumi/core/pull/2161
- style: update the padding at the top/bottom of the popover component by @yantze in https://github.com/opensumi/core/pull/2175
- style: remove some useless tree style by @erha19 in https://github.com/opensumi/core/pull/2186

### Other Changes

- fix: code snippets prefix supports array by @shilin8805 in https://github.com/opensumi/core/pull/1891
- chore: use stable extension marketplace registry by @erha19 in https://github.com/opensumi/core/pull/1886
- chore: fix issue labeled by @erha19 in https://github.com/opensumi/core/pull/1905
- chore: update README and add CHANGELOG file by @erha19 in https://github.com/opensumi/core/pull/1904
- chore: fix issue labeled syntax error by @erha19 in https://github.com/opensumi/core/pull/1907
- chore: fix issue labeled config by @erha19 in https://github.com/opensumi/core/pull/1916
- test: add settings view test by @erha19 in https://github.com/opensumi/core/pull/1911
- test: add SCM e2e test by @erha19 in https://github.com/opensumi/core/pull/1934
- chore: add iconfont page deploy workflow by @erha19 in https://github.com/opensumi/core/pull/1944
- ci: use opensumi/actions by @bytemain in https://github.com/opensumi/core/pull/1946
- chore: add src into package files by @erha19 in https://github.com/opensumi/core/pull/1949
- fix: auto save opened file after replace all by @AEPKILL in https://github.com/opensumi/core/pull/1948
- chore: update iconfont page resources by @erha19 in https://github.com/opensumi/core/pull/1950
- build: use yarn workspace by @bytemain in https://github.com/opensumi/core/pull/1954
- chore: update lock file by @erha19 in https://github.com/opensumi/core/pull/2005
- fix: support onSaveCodeActions with ESLint extension by @erha19 in https://github.com/opensumi/core/pull/2023
- fix: use bash resolve shellpath by @Aaaaash in https://github.com/opensumi/core/pull/2021
- fix: progress codeAction when codeActionOnSave existed by @erha19 in https://github.com/opensumi/core/pull/2027
- fix: pause debug will not open stackframe source file by @Ricbet in https://github.com/opensumi/core/pull/2028
- chore: optimize default extension icon by @bk1012 in https://github.com/opensumi/core/pull/2030
- test: add layout e2e test by @erha19 in https://github.com/opensumi/core/pull/2044
- chore: fix web-lite and electron entry by @erha19 in https://github.com/opensumi/core/pull/2053
- chore: fail to start electron by @yantze in https://github.com/opensumi/core/pull/2057
- fix: electron cannot work by @bytemain in https://github.com/opensumi/core/pull/2060
- chore: remove errors from clipboard service by @erha19 in https://github.com/opensumi/core/pull/2054
- fix(extension): windows get globalStorageUri error by @bytemain in https://github.com/opensumi/core/pull/2068
- fix: debug on multiple processes by @erha19 in https://github.com/opensumi/core/pull/2080
- fix: new file with path on compress tree node by @erha19 in https://github.com/opensumi/core/pull/2084
- chore: update defualt theme by @Aaaaash in https://github.com/opensumi/core/pull/2087
- chore: update web lite sample link by @erha19 in https://github.com/opensumi/core/pull/2090
- fix: the tree node child maybe undefined by @erha19 in https://github.com/opensumi/core/pull/2096
- fix: create output editor when panel visible by @Aaaaash in https://github.com/opensumi/core/pull/2105
- fix: create debug console editor when panel visible by @Aaaaash in https://github.com/opensumi/core/pull/2106
- fix: update keybindings when keymap view rendered by @Aaaaash in https://github.com/opensumi/core/pull/2104
- fix: quick open argument by @Aaaaash in https://github.com/opensumi/core/pull/2117
- chore: fix unstable fileServiceClient unit test by @erha19 in https://github.com/opensumi/core/pull/2116
- fix: copy dir with recursive in rebuild-native script by @yantze in https://github.com/opensumi/core/pull/2122
- fix: webview cspSource by @Aaaaash in https://github.com/opensumi/core/pull/2120
- fix: save file diff error by @Aaaaash in https://github.com/opensumi/core/pull/2113
- fix: unnecessary re-tokenizer by @Aaaaash in https://github.com/opensumi/core/pull/2125
- chore: update opened editor group name by @erha19 in https://github.com/opensumi/core/pull/2118
- fix: search rules display logic by @erha19 in https://github.com/opensumi/core/pull/2124
- fix: disable some keybindings on file tree filter mode by @erha19 in https://github.com/opensumi/core/pull/2132
- fix: duplicate search results by @erha19 in https://github.com/opensumi/core/pull/2123
- fix: debounce editor layout by @Aaaaash in https://github.com/opensumi/core/pull/2134
- fix: unnecessary editor update options by @Aaaaash in https://github.com/opensumi/core/pull/2133
- fix: do not exclude .gitignore by @Aaaaash in https://github.com/opensumi/core/pull/2142
- chore: yarn lock by @Ricbet in https://github.com/opensumi/core/pull/2147
- build: update deps by @bytemain in https://github.com/opensumi/core/pull/2148
- test: add Javascript Debug Terminal test case by @erha19 in https://github.com/opensumi/core/pull/2150
- test: add search e2e test case by @erha19 in https://github.com/opensumi/core/pull/2149
- fix: highlight search content when ignoring case by @erha19 in https://github.com/opensumi/core/pull/2151
- test: add output panel e2e test case by @erha19 in https://github.com/opensumi/core/pull/2152
- chore(devtools): add sumi bin by @bytemain in https://github.com/opensumi/core/pull/2153
- chore: yarn lock by @Ricbet in https://github.com/opensumi/core/pull/2171
- fix: improve SCM experience on the workspace project by @erha19 in https://github.com/opensumi/core/pull/2168
- fix: merge editor conflict action error by @Ricbet in https://github.com/opensumi/core/pull/2163
- chore: update large file size limit by @erha19 in https://github.com/opensumi/core/pull/2162
- chore: update some logs on extension host process service by @erha19 in https://github.com/opensumi/core/pull/2173
- fix: prefix quick open should trim input by @bytemain in https://github.com/opensumi/core/pull/2172
- fix: improve regexp search ux by @erha19 in https://github.com/opensumi/core/pull/2185
- fix(editor): add missing edit stack when save by @bytemain in https://github.com/opensumi/core/pull/2192
- fix: settings.json should be JSONC by @bytemain in https://github.com/opensumi/core/pull/2181
- fix: support collaborationWsPath config by @Ricbet in https://github.com/opensumi/core/pull/2193
- fix: fix the marker outer area click error by @erha19 in https://github.com/opensumi/core/pull/2195
- fix: get valid preference value from the user scope by @erha19 in https://github.com/opensumi/core/pull/2196
- fix: create diff and merge editor as needed by @Aaaaash in https://github.com/opensumi/core/pull/2135

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

#### 5. Revert to using `nsfw` watcher library in Linux

Because `parcel/watcher` has memory out-of-bounds access problem under Linux, which triggers sigsegv and causes crash, so `nsfw` is still used under Linux. https://github.com/parcel-bundler/watcher/issues/49

It is recommended to add dependencies globally:

```diff
+ "nsfw": "2.2.0"
```

At the same time, `nsfw` needs to be added back into the build，e.g `webpack.node.config.ts`

```diff
externals: [
  ({ context, request }, callback) => {
    if (['node-pty', '@parcel/watcher', 'spdlog', '@opensumi/vscode-ripgrep', 'vm2', 'keytar'].indexOf(request || '') !== -1) {
+   if (['node-pty', '@parcel/watcher', 'nsfw', 'spdlog', '@opensumi/vscode-ripgrep', 'vm2', 'keytar'].indexOf(request || '') !== -1) {
      return callback(undefined, `commonjs ${request}`);
    }
    callback();
  },
],
```

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
