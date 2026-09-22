#!/bin/bash
# =======================================================
# SAL 教師用観察パネル - ワンクリック起動スクリプト (macOS)
# =======================================================
cd "$(dirname "$0")" || exit 1

# Deno のバイナリパスを探索
DENO_BIN=""
if command -v deno >/dev/null 2>&1; then
  DENO_BIN="$(command -v deno)"
elif [ -x "$HOME/.deno/bin/deno" ]; then
  DENO_BIN="$HOME/.deno/bin/deno"
elif [ -x "/opt/homebrew/bin/deno" ]; then
  DENO_BIN="/opt/homebrew/bin/deno"
elif [ -x "/usr/local/bin/deno" ]; then
  DENO_BIN="/usr/local/bin/deno"
fi

if [ -z "$DENO_BIN" ]; then
  echo "======================================================="
  echo "❌ Deno が見つかりませんでした。"
  echo "本スクリプトの実行には Deno のインストールが必要です。"
  echo ""
  echo "以下のコマンドをターミナルで実行してインストールしてください:"
  echo "  curl -fsSL https://deno.land/install.sh | sh"
  echo "======================================================="
  read -n 1 -s -r -p "何かキーを押すと終了します..."
  echo ""
  exit 1
fi

exec "$DENO_BIN" run -A init.ts "$@"
