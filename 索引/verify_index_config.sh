#!/bin/bash

# Cursor 自动索引配置验证脚本

echo "=========================================="
echo "Cursor 自动索引配置验证"
echo "=========================================="
echo ""

PROJECT_DIR="/Users/zckfacai/Library/CloudStorage/GoogleDrive-zhengchenkai0307@gmail.com/我的云端硬盘/My_AI_Brain"
CURSOR_USER_DIR="$HOME/Library/Application Support/Cursor/User"

# 检查项目配置文件
echo "📁 检查项目配置文件..."
if [ -f "$PROJECT_DIR/.vscode/settings.json" ]; then
    echo "✅ .vscode/settings.json 存在"
    if grep -q "cursor.index.enabled" "$PROJECT_DIR/.vscode/settings.json"; then
        echo "✅ 索引配置已设置"
    else
        echo "❌ 索引配置未找到"
    fi
else
    echo "❌ .vscode/settings.json 不存在"
fi

# 检查 .cursorignore 文件
echo ""
echo "📁 检查索引忽略文件..."
if [ -f "$PROJECT_DIR/.cursorignore" ]; then
    echo "✅ .cursorignore 文件存在"
    echo "   排除规则："
    grep -v "^#" "$PROJECT_DIR/.cursorignore" | grep -v "^$" | sed 's/^/   - /'
else
    echo "❌ .cursorignore 文件不存在"
fi

# 检查全局配置
echo ""
echo "📁 检查全局配置文件..."
if [ -f "$CURSOR_USER_DIR/settings.json" ]; then
    echo "✅ 全局 settings.json 存在"
    if grep -q "cursor.index" "$CURSOR_USER_DIR/settings.json"; then
        echo "✅ 全局索引配置已设置"
    else
        echo "⚠️  全局索引配置未设置（可选）"
    fi
else
    echo "❌ 全局 settings.json 不存在"
fi

# 检查 Cursor 是否运行
echo ""
echo "🔍 检查 Cursor 进程..."
if pgrep -f "Cursor" > /dev/null; then
    echo "✅ Cursor 正在运行"
    echo "   建议：重启 Cursor 以确保配置生效"
else
    echo "⚠️  Cursor 未运行"
    echo "   建议：启动 Cursor 并打开项目文件夹"
fi

echo ""
echo "=========================================="
echo "验证完成！"
echo "=========================================="
echo ""
echo "📝 下一步操作："
echo "1. 如果 Cursor 正在运行，请重启 Cursor"
echo "2. 打开项目文件夹：$PROJECT_DIR"
echo "3. 按 Cmd + Shift + P，输入 'Index' 查看索引命令"
echo "4. 按 Cmd + K 测试 AI 功能是否正常工作"
echo ""
echo "📚 详细说明请查看：AUTO_INDEX_SETUP.md"
