#!/bin/bash

# 创建 gofly_admin_v3 的符号链接
if [ ! -d "gofly_admin_v3" ] && [ -d "apps/backend/gofly_admin_v3" ]; then
    ln -s apps/backend/gofly_admin_v3 gofly_admin_v3
    echo "Created symlink: gofly_admin_v3 -> apps/backend/gofly_admin_v3"
else
    echo "gofly_admin_v3 already exists or source not found"
fi