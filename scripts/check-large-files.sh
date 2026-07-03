#!/bin/bash

# 查找仓库中最大的文件
echo "查找仓库中最大的文件（前 20 个）:"
echo "=================================="

# 查找所有 blob 对象并按大小排序
git rev-list --objects --all | \
grep -f <(git verify-pack -v .git/objects/pack/pack-*.idx | grep blob | sort -k3 -n | cut -f1 -d' ' | head -20) | \
cut -d' ' -f2- | \
while read object; do
    if [ -f "$object" ]; then
        size=$(stat -f%z "$object" 2>/dev/null || stat -c%s "$object" 2>/dev/null)
        if [ "$size" -gt 100000 ]; then
            echo "$size bytes - $object"
        fi
    else
        echo "文件不存在: $object"
    fi
done

echo ""
echo "检查可能的大文件类型:"
echo "========================"

# 检查 node_modules 中是否有文件被跟踪
if git ls-files | grep -q "node_modules"; then
    echo "⚠️  发现 node_modules 中的文件被跟踪:"
    git ls-files | grep "node_modules" | wc -l | xargs echo "  共计"
fi

# 检查缓存文件
if git ls-files | grep -E "\.(cache|log|tmp|bak)$"; then
    echo "⚠️  发现缓存文件被跟踪:"
    git ls-files | grep -E "\.(cache|log|tmp|bak)$"
fi

# 检查二进制文件
if git ls-files | grep -E "\.(exe|dll|so|dylib|a|lib|o|obj)$"; then
    echo "⚠️  发现二进制文件被跟踪:"
    git ls-files | grep -E "\.(exe|dll|so|dylib|a|lib|o|obj)$"
fi