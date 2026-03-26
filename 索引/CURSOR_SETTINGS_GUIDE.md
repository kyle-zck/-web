# Cursor 设置配置指南

## 打开设置的多种方法

### 方法 1：使用快捷键（最快）
- **macOS**: 按 `Cmd + ,`（Command + 逗号）
- **Windows/Linux**: 按 `Ctrl + ,`

### 方法 2：通过命令面板
1. 按 `Cmd + Shift + P`（macOS）或 `Ctrl + Shift + P`（Windows/Linux）
2. 输入 "Preferences: Open Settings" 或 "设置"
3. 选择相应的选项

### 方法 3：通过菜单栏
1. 点击顶部菜单栏的 **Cursor**（macOS）或 **File**（Windows/Linux）
2. 选择 **Preferences** > **Settings** 或 **首选项** > **设置**

### 方法 4：直接编辑配置文件
- **全局设置**: `~/Library/Application Support/Cursor/User/settings.json`
- **项目设置**: `.vscode/settings.json`（已在项目中创建）

## 索引配置说明

### 已创建的配置文件

1. **`.vscode/settings.json`** - 项目级别设置
   - 已启用自动索引功能
   - 配置了文件监听排除规则

2. **`.cursorignore`** - 索引忽略文件
   - 排除系统文件和临时文件
   - 优化索引性能

### 索引相关设置项

在设置界面中搜索以下关键词：
- `cursor.index` - 索引相关设置
- `index` - 索引功能
- `retrieval` - 代码检索功能

### 手动触发索引

如果自动索引未启动，可以：
1. 打开命令面板（`Cmd + Shift + P`）
2. 输入 "Index" 或 "索引"
3. 选择 "Cursor: Index Workspace" 或类似选项

## 验证索引是否工作

1. 在 Cursor 中打开任意文件
2. 使用 `Cmd + K`（macOS）或 `Ctrl + K`（Windows/Linux）打开 Cursor 的 AI 功能
3. 询问关于项目内容的问题，如果 AI 能回答，说明索引已生效

## 注意事项

- 索引过程可能需要一些时间，特别是对于大型项目
- 可以在状态栏查看索引进度
- 如果遇到问题，可以重启 Cursor 让配置生效
