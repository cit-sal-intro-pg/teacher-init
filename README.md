# SAL Teacher Initializer (`sal-teacher-initializer`)

小学校高学年向けプログラミング教材「SAL (Sugoroku Active Learning)」の教師用観察パネル専用イニシャライザーです。  
クライアント端末上の Deno を用いて、SAL サーバー（FastAPI）から配信される TypeScript コードをオンザフライでトランスパイルし、DuckDB-Wasm + Malloy による多次元分析画面をブラウザまたはネイティブ WebView 上にワンコマンドで立ち上げます。

---

## 特長

1. **ワンコマンド初期化＆起動**:
   - `deno run -A http://sal.local:8000/app/teacher/initializer/init.ts`（またはインストール済みコマンド `sal-teacher`）を叩くだけで、ローカルプロキシ起動 ➔ TSオンザフライトランスパイル ➔ ブラウザ表示が一気通貫で完了します。
2. **OS 標準ブラウザ最優先 ＆ 軽量 `deno-webview` フォールバック**:
   - macOS（`open`）、Windows（`start`）、Linux（`xdg-open`）による既存ブラウザの起動を最優先。
   - ブラウザが見つからない場合や独立ウィンドウで動かしたい場合は、OS ネイティブの WebKit / WebView2 / WebKitGTK を利用する `deno-webview` にフォールバックするため、巨大な Chromium バイナリのダウンロードが一切不要です。
3. **教室 Wi-Fi 通信負荷ゼロ（重い資産の事前キャッシュ）**:
   - DuckDB-Wasm や Malloy、DaisyUI CSS、WebView 依存は、事前の `--prep` 実行時にローカル（`~/.cache/sal/teacher/`）へキャッシュ。授業中の閉域 LAN では重い Wasm の転送が一切発生しません。
4. **サーバー環境の完全 Python 純化**:
   - サーバー側ホスト（親機 Mac）で Node.js や Vite、`node_modules` のビルド環境を抱える必要がなくなり、FastAPI + `uv` のみで完全動作します。
5. **公開リポジトリ安全設計**:
   - 本イニシャライザーには教材の機密データや個人情報、プライベートなビジネスロジックは一切含まれません。OSS として単独のパブリックリポジトリに分離・公開可能です。

---

## 使い方

### 1. 事前準備（インターネット接続環境で 1 回だけ実行）

自宅や職員室など、インターネットが使える環境で以下のコマンドを実行し、必要な基盤アセットをローカルにキャッシュします。

```bash
# 準備コマンドの実行（Wasm, Malloy, DaisyUI CSS をローカルキャッシュ）
deno run -A init.ts --prep
```

> **💡 日常利用をさらに簡単にする「コマンド化（エイリアス）」:**
> ```bash
> deno install -Agf -n sal-teacher init.ts
> ```
> これを実行しておくと、以降はターミナルで `sal-teacher` と打つだけで起動できるようになります。

---

### 2. 授業本番（教室の完全オフライン・閉域 LAN 環境）

教室で親機 Mac のローカル AP（`sal.local`）に接続し、以下のワンコマンドを実行します。

```bash
# 標準起動（http://sal.local:8000 に接続してブラウザを自動起動）
deno run -A init.ts

# （または、インストール済みの場合）
sal-teacher
```

#### mDNS が名前解決できない環境（自治体管理端末など）の場合
サーバーの IP アドレスを引数に渡すことで、即座に直接接続できます。

```bash
deno run -A init.ts http://192.168.2.1:8000
```

---

## コマンドラインオプション

```text
Usage:
  deno run -A init.ts [server_url] [options]

Arguments:
  server_url           接続先 SAL サーバーの URL（デフォルト: http://sal.local:8000）

Options:
  --prep, -p           事前キャッシュモード（ネット接続時に実行して終了）
  --port <port>        ローカルプロキシ待受ポート（デフォルト: 5173）
  --webview            OS 標準ブラウザの代わりにネイティブ WebView ウィンドウを優先
  --no-open            ブラウザ / WebView の自動起動をスキップ
  --help, -h           ヘルプメッセージを表示
```

---

## アーキテクチャ

```text
[SAL サーバー (FastAPI:8000)]
      │
      │ HTTP (LAN閉域通信: TS / HTML / Parquet / REST API)
      ▼
[Deno Teacher Initializer (localhost:5173)]
      ├─ Local Cache (~/.cache/sal/) ── DuckDB-Wasm / Malloy / DaisyUI
      ├─ On-the-fly Transpiler ──────── .ts ➔ .js (ES2022)
      ├─ Reverse Proxy ──────────────── API / Parquet 通信を SAL サーバーへ透過中継
      └─ Window Launcher ────────────── OS Default Browser (open/start/xdg-open)
                                        └─ Fallback: Native OS WebView (deno-webview)
            │
            ▼ HTTP
   [クライアントの Web ブラウザ (Chrome / Safari / Edge) または Native WebView]
```
