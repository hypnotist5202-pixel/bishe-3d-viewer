#!/bin/bash
# 一键部署脚本：commit → push → 自动 pin HTML 到当前 commit hash → 再 push
# 用途：彻底绕过 jsDelivr @main 分支的 12h CDN 缓存延迟
# 用法：./tools/deploy.sh "commit 信息"

set -e
cd "$(dirname "$0")/.."

MSG="${1:-update}"

git add -A
if git diff --cached --quiet; then
  echo "无待提交改动，跳过首次 commit"
else
  git commit -m "$MSG"
  git push
fi

HASH=$(git rev-parse --short=7 HEAD)
echo "当前 commit hash: $HASH"

# 把 HTML 里所有 @xxxxxxx/assets 替换为 @HASH/assets
sed -i '' "s|@[a-f0-9]\{7,\}/assets|@$HASH/assets|g" index.html

if git diff --quiet index.html; then
  echo "HTML 已经 pin 到 $HASH，无需再次 commit"
else
  git add index.html
  git commit -m "deploy: pin jsdelivr to @$HASH"
  git push
  echo "✓ HTML 已 pin 到 @$HASH 并推送"
fi

echo "✓ 部署完成 — 公网 URL: https://hypnotist5202-pixel.github.io/bishe-3d-viewer/"
