#!/bin/bash
# 重新生成 sw.js（新增素材/代码后执行）
cd "$(dirname "$0")/.." && { 
  echo "// Service Worker：离线缓存（自动生成，勿手改；新增文件后重跑 tools/make-sw.sh）"
  echo "const CACHE = 'gymrun-v23';"
  echo "const ASSETS = ["
  echo "'./',"
  for f in index.html manifest.webmanifest css/style.css js/*.js assets/sprites/*.png assets/sprites-shiny/*.png assets/items/*.png; do echo "'$f',"; done
  echo "];"
  cat tools/sw-tail.js
} > sw.js
