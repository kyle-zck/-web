#!/bin/bash

# 检查 Cursor 索引状态脚本

echo "=========================================="
echo "Cursor 索引状态检查"
echo "=========================================="
echo ""

PROJECT_DIR="/Users/zckfacai/Library/CloudStorage/GoogleDrive-zhengchenkai0307@gmail.com/我的云端硬盘/My_AI_Brain"
CURSOR_STORAGE="$HOME/Library/Application Support/Cursor/User"

# 检查 Cursor 是否运行
echo "🔍 检查 Cursor 进程..."
if pgrep -f "Cursor" > /dev/null; then
    echo "✅ Cursor 正在运行"
    CURSOR_RUNNING=true
else
    echo "❌ Cursor 未运行"
    echo "   提示：请先启动 Cursor 并打开项目文件夹"
    CURSOR_RUNNING=false
fi

echo ""
echo "📁 检查索引数据..."

# 检查全局索引检查点
CHECKPOINT_COUNT=$(find "$CURSOR_STORAGE/globalStorage/anysphere.cursor-retrieval/checkpoints" -type d -mindepth 1 2>/dev/null | wc -l | tr -d ' ')
if [ "$CHECKPOINT_COUNT" -gt 0 ]; then
    echo "✅ 找到 $CHECKPOINT_COUNT 个全局索引检查点"
    echo "   最新检查点："
    ls -lt "$CURSOR_STORAGE/globalStorage/anysphere.cursor-retrieval/checkpoints" 2>/dev/null | head -3 | tail -2 | awk '{print "   - " $9 " (" $6 " " $7 " " $8 ")"}'
else
    echo "⚠️  未找到全局索引检查点"
fi

# 检查工作区索引
WORKSPACE_COUNT=$(find "$CURSOR_STORAGE/workspaceStorage" -type d -name "cursor-retrieval" 2>/dev/null | wc -l | tr -d ' ')
if [ "$WORKSPACE_COUNT" -gt 0 ]; then
    echo "✅ 找到 $WORKSPACE_COUNT 个工作区索引目录"
    
    # 检查是否有当前项目的索引
    PROJECT_FOUND=false
    for ws_dir in "$CURSOR_STORAGE/workspaceStorage"/*/anysphere.cursor-retrieval; do
        if [ -d "$ws_dir" ]; then
            if [ -f "$ws_dir/high_level_folder_description.txt" ] || [ -f "$ws_dir/embeddable_files.txt" ]; then
                echo "   📂 工作区索引目录：$(basename $(dirname $ws_dir))"
                if [ -f "$ws_dir/high_level_folder_description.txt" ]; then
                    echo "      ✅ 包含高级文件夹描述"
                fi
                if [ -f "$ws_dir/embeddable_files.txt" ]; then
                    FILE_COUNT=$(wc -l < "$ws_dir/embeddable_files.txt" 2>/dev/null | tr -d ' ')
                    echo "      ✅ 包含 $FILE_COUNT 个可嵌入文件列表"
                fi
                PROJECT_FOUND=true
            fi
        fi
    done
    
    if [ "$PROJECT_FOUND" = false ]; then
        echo "   ⚠️  当前项目可能尚未被索引"
    fi
else
    echo "⚠️  未找到工作区索引目录"
fi

echo ""
echo "📊 索引活动检查..."

# 检查最近的索引活动（通过检查点时间戳）
LATEST_CHECKPOINT=$(find "$CURSOR_STORAGE/globalStorage/anysphere.cursor-retrieval/checkpoints" -type d -mindepth 1 -exec stat -f "%m %N" {} \; 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)
if [ -n "$LATEST_CHECKPOINT" ] && [ -f "$LATEST_CHECKPOINT/metadata.json" ]; then
    TIMESTAMP=$(grep -o '"startTrackingDateUnixMilliseconds":[0-9]*' "$LATEST_CHECKPOINT/metadata.json" 2>/dev/null | cut -d':' -f2)
    if [ -n "$TIMESTAMP" ]; then
        # 转换为可读日期（macOS）
        DATE_STR=$(date -r $((TIMESTAMP/1000)) "+%Y-%m-%d %H:%M:%S" 2>/dev/null)
        if [ -n "$DATE_STR" ]; then
            echo "   最新索引活动：$DATE_STR"
        fi
    fi
fi

echo ""
echo "=========================================="
echo "检查结果总结"
echo "=========================================="
echo ""

if [ "$CURSOR_RUNNING" = true ]; then
    echo "✅ Cursor 正在运行"
    echo ""
    echo "📝 验证索引是否工作的步骤："
    echo "1. 在 Cursor 中确认已打开项目文件夹"
    echo "2. 按 Cmd + Shift + P，输入 'Index' 查看索引命令"
    echo "3. 按 Cmd + K 测试 AI 功能"
    echo "4. 询问关于项目文件的问题，看 AI 是否能回答"
    echo ""
    echo "💡 如果索引未工作："
    echo "   - 按 Cmd + Shift + P，输入 'Cursor: Index Workspace'"
    echo "   - 或重启 Cursor 让配置生效"
else
    echo "⚠️  Cursor 未运行"
    echo ""
    echo "📝 下一步："
    echo "1. 启动 Cursor"
    echo "2. 打开项目文件夹：$PROJECT_DIR"
    echo "3. 等待索引自动开始（可能需要几分钟）"
fi

echo ""
echo "📚 详细说明请查看：AUTO_INDEX_SETUP.md"
