#!/usr/bin/env bash
# 一次性填入 GitHub 用户名和仓库名：
#   bash scripts/setup.sh <github用户名> <仓库名>
set -euo pipefail
if [ $# -ne 2 ]; then
  echo "用法：bash scripts/setup.sh <github用户名> <仓库名>"
  exit 1
fi
USER="$1"; REPO="$2"
cd "$(dirname "$0")/.."
for f in quartz.config.yaml quartz.ts 部署说明.md README.md; do
  [ -f "$f" ] || continue
  sed -i.bak "s/__GH_USER__/$USER/g; s/__GH_REPO__/$REPO/g" "$f"
  rm -f "$f.bak"
done
echo "✓ 已填入 $USER/$REPO"
echo "  站点地址将是：https://$USER.github.io/$REPO"
