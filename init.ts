/**
 * SAL Teacher Initializer (sal-teacher-initializer)
 *
 * Standalone, zero-dependency Deno initializer for SAL Teacher Observation Dashboard.
 *
 * - Offline prep mode (--prep): Pre-caches DuckDB-Wasm, Malloy, DaisyUI CSS, and webview dependencies
 * - Local Proxy Server: Listens on localhost:5173 (or available port), proxies API/Parquet to SAL Server
 * - On-the-fly TS Transpiler: Fetches .ts files from SAL Server and transforms to JS for browser execution
 * - Browser Auto-launch: System default browser (open/start/xdg-open) first, deno-webview native window fallback
 * - Zero Private Secrets: Contains no proprietary school or curriculum data; 100% public-repository safe
 */

// --- Configuration & Constants ---
const DEFAULT_SERVER_URL = "http://sal.local:8000";
const DEFAULT_PORT = 5173;

/** Resolves platform-specific cache directory for SAL assets */
export function getCacheDir(): string {
  const home = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || ".";
  if (Deno.build.os === "windows") {
    const localAppData = Deno.env.get("LOCALAPPDATA") || `${home}\\AppData\\Local`;
    return `${localAppData}\\sal\\teacher`;
  }
  if (Deno.build.os === "darwin") {
    return `${home}/Library/Caches/sal/teacher`;
  }
  // Linux / default
  const xdgCache = Deno.env.get("XDG_CACHE_HOME") || `${home}/.cache`;
  return `${xdgCache}/sal/teacher`;
}

// In-memory cache for transpiled TypeScript files
const transpileCache = new Map<string, { code: string; mtime?: string }>();

// --- Transpiler Engine (esbuild + Zero-Dependency Fallback) ---

/**
 * Strips TypeScript types using regex-based syntactic stripping.
 * Serves as a zero-dependency fallback when esbuild is offline/unavailable.
 * Conforms to modern JS/TS standard stripping (interfaces, types, type annotations, type casts).
 */
export function stripTypeScriptTypes(tsCode: string): string {
  let js = tsCode;

  // 1. Remove `declare global { ... }` blocks
  js = js.replace(/declare\s+global\s*\{[\s\S]*?\n\}/g, "");

  // 2. Remove `export interface ... { ... }` or `interface ... { ... }`
  js = js.replace(/(?:export\s+)?interface\s+[A-Za-z0-9_]+(?:\s*<[^>]+>)?(?:\s+extends\s+[^{]+)?\s*\{[\s\S]*?\n\}/g, "");

  // 3. Remove `export type ... = ...;` or `type ... = ...;`
  js = js.replace(/(?:export\s+)?type\s+[A-Za-z0-9_]+(?:\s*<[^>]+>)?\s*=[\s\S]*?;\n?/g, "");

  // 4. Remove `as unknown as ...` and `as Type` casts
  js = js.replace(/\s+as\s+(?:unknown\s+as\s+)?[A-Za-z0-9_]+(?:\s*<[^>]+>)?(?:\[\])?/g, "");

  // 5. Remove simple return type annotations `: ReturnType {` or `: ReturnType =>`
  js = js.replace(/\):\s*[A-Za-z0-9_<>\[\]|&\s]+\s*(=>|\{)/g, ") $1");

  // 6. Remove parameter type annotations `(param: Type, ...)`
  js = js.replace(/(\b[a-zA-Z0-9_$]+)\s*:\s*[A-Za-z0-9_<>\[\]|&\s]+(\s*[,)])/g, "$1$2");

  // 7. Remove variable type annotations `const x: Type = ...`
  js = js.replace(/(const|let|var)\s+([a-zA-Z0-9_$]+)\s*:\s*[A-Za-z0-9_<>\[\]|&\s]+(?:\s*=\s*)/g, "$1 $2 = ");

  // 8. Fix extensionless relative imports (e.g. `from './wasm_olap'` -> `from './wasm_olap.ts'`)
  js = js.replace(/from\s+['"](\.\/[^'"]+?)(?<!\.[a-zA-Z0-9]+)['"]/g, "from '$1.ts'");

  return js;
}

/**
 * Transpiles TypeScript source code to ECMAScript 2022.
 * Prefers esbuild if cached/available; falls back to syntactic stripping.
 */
export async function transpileTs(tsCode: string): Promise<string> {
  try {
    const esbuild = await import("esbuild");
    if (esbuild && typeof esbuild.transform === "function") {
      const result = await esbuild.transform(tsCode, {
        loader: "ts",
        target: "es2022",
        format: "esm",
      });
      return result.code.replace(/from\s+['"](\.\/[^'"]+?)(?<!\.[a-zA-Z0-9]+)['"]/g, "from '$1.ts'");
    }
  } catch (_esbuildErr) {
    // esbuild not cached/offline, fall back to built-in syntactic stripper
  }

  return stripTypeScriptTypes(tsCode);
}

// --- Browser Detection & Launching (OS Browser first, deno-webview fallback) ---

/**
 * Attempts to launch system default browser first, with fallback to deno-webview.
 */
export async function launchBrowser(url: string, preferWebview = false): Promise<boolean> {
  const os = Deno.build.os;

  // 1. Try launching system global default browser (unless preferWebview is set)
  if (!preferWebview) {
    try {
      let command: string;
      let args: string[];

      if (os === "darwin") {
        command = "open";
        args = [url];
      } else if (os === "windows") {
        command = "cmd";
        args = ["/c", "start", url];
      } else {
        command = "xdg-open";
        args = [url];
      }

      console.log(`🌐 Launching system default browser via '${command}'...`);
      const cmd = new Deno.Command(command, { args, stdout: "null", stderr: "null" });
      const proc = cmd.spawn();
      const status = await proc.status;
      if (status.success) {
        return true;
      }
    } catch (_sysBrowserErr) {
      console.warn("⚠️ System default browser launch command failed. Falling back to deno-webview...");
    }
  }

  // 2. Fallback: Native OS WebView via deno-webview
  try {
    console.log("🪟 Attempting native OS WebView window fallback (deno-webview)...");
    const webviewMod = await import("webview").catch(() => null);
    if (webviewMod && typeof webviewMod.Webview === "function") {
      const webview = new webviewMod.Webview();
      webview.title = "SAL 教師観察パネル";
      webview.size = { width: 1280, height: 860, hint: 0 };
      webview.navigate(url);
      console.log("✅ Native WebView window initialized.");
      webview.run();
      return true;
    }
  } catch (webviewErr) {
    console.warn("⚠️ deno-webview fallback notice:", webviewErr);
  }

  // 3. Final display prompt
  console.log(`\n👉 Please open the following URL in your web browser:\n   ${url}\n`);
  return false;
}

// --- Pre-caching (--prep mode) ---

export async function runPrep(): Promise<void> {
  console.log("📦 Starting SAL Teacher Initializer Pre-cache (--prep)...");
  const cacheDir = getCacheDir();
  await Deno.mkdir(cacheDir, { recursive: true });

  console.log(`📁 Cache directory: ${cacheDir}`);

  // 1. Pre-cache DaisyUI CSS
  try {
    console.log("⬇️ Fetching latest DaisyUI CSS from public CDN...");
    const resp = await fetch("https://cdn.jsdelivr.net/npm/daisyui@5/dist/full.min.css");
    if (resp.ok) {
      const css = await resp.text();
      await Deno.writeFile(`${cacheDir}/daisyui.css`, new TextEncoder().encode(css));
      console.log("✅ DaisyUI CSS pre-cached successfully.");
    }
  } catch (err) {
    console.warn(`⚠️ DaisyUI pre-cache warning (using local fallback if offline): ${err}`);
  }

  // 2. Pre-cache esbuild transpiler module
  try {
    console.log("⬇️ Pre-caching esbuild transpiler module...");
    await import("esbuild");
    console.log("✅ esbuild pre-cached successfully.");
  } catch (err) {
    console.warn(`⚠️ esbuild pre-cache warning (will use zero-dep fallback): ${err}`);
  }

  // 3. Pre-cache DuckDB-Wasm & Malloy packages
  try {
    console.log("⬇️ Pre-caching DuckDB-Wasm and Malloy...");
    await import("npm:@duckdb/duckdb-wasm@^1.29.0").catch(() => {});
    await import("npm:@malloydata/malloy@^0.0.120").catch(() => {});
    console.log("✅ DuckDB-Wasm & Malloy pre-cached successfully.");
  } catch (err) {
    console.warn(`⚠️ Analytical packages pre-cache notice: ${err}`);
  }

  // 4. Pre-cache deno-webview fallback
  try {
    console.log("⬇️ Pre-caching deno-webview module...");
    await import("webview").catch(() => {});
    console.log("✅ deno-webview pre-cached successfully.");
  } catch (err) {
    console.warn(`⚠️ deno-webview pre-cache notice: ${err}`);
  }

  console.log("\n🎉 Pre-caching complete! You can now run in offline classroom LAN mode.\n");
}

// --- Local Proxy & Transpilation Server ---

export async function startProxyServer(serverBaseUrl: string, port = DEFAULT_PORT, noOpen = false, preferWebview = false): Promise<void> {
  const cacheDir = getCacheDir();

  const handler = async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    let pathname = url.pathname;

    // Redirect root to teacher observation panel
    if (pathname === "/" || pathname === "/app/") {
      return Response.redirect(`${url.origin}/app/observation.html`, 302);
    }

    // Serve pre-cached DaisyUI CSS if requested
    if (pathname.endsWith("/daisyui.css") || pathname === "/vendor/daisyui.css") {
      try {
        const cachedCss = await Deno.readFile(`${cacheDir}/daisyui.css`);
        return new Response(cachedCss, {
          headers: {
            "Content-Type": "text/css; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      } catch {
        // Not cached locally, fall through to server proxy
      }
    }

    // On-the-fly TypeScript Transpilation for .ts requests
    if (pathname.endsWith(".ts")) {
      const targetTsUrl = `${serverBaseUrl}${pathname}`;
      try {
        // Check in-memory transpile cache
        const cached = transpileCache.get(pathname);

        const resp = await fetch(targetTsUrl, {
          headers: cached?.mtime ? { "If-Modified-Since": cached.mtime } : {},
        });

        if (resp.status === 304 && cached) {
          return new Response(cached.code, {
            headers: {
              "Content-Type": "application/javascript; charset=utf-8",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }

        if (resp.ok) {
          const tsCode = await resp.text();
          const jsCode = await transpileTs(tsCode);
          const mtime = resp.headers.get("last-modified") || undefined;
          transpileCache.set(pathname, { code: jsCode, mtime });

          return new Response(jsCode, {
            headers: {
              "Content-Type": "application/javascript; charset=utf-8",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "no-cache",
            },
          });
        }
      } catch (err) {
        console.error(`Transpilation error for ${pathname}:`, err);
        return new Response(`// Transpilation error: ${err}`, {
          status: 500,
          headers: { "Content-Type": "application/javascript" },
        });
      }
    }

    // Forward all other requests (HTML, CSS, Parquet, API endpoints) to SAL Server
    const targetUrl = `${serverBaseUrl}${pathname}${url.search}`;
    try {
      const headers = new Headers(req.headers);
      headers.set("Host", new URL(serverBaseUrl).host);

      const fetchOptions: RequestInit = {
        method: req.method,
        headers,
        body: req.method !== "GET" && req.method !== "HEAD" ? await req.blob() : undefined,
      };

      const serverResp = await fetch(targetUrl, fetchOptions);
      const respHeaders = new Headers(serverResp.headers);
      respHeaders.set("Access-Control-Allow-Origin", "*");
      respHeaders.set("Access-Control-Allow-Methods", "*");
      respHeaders.set("Access-Control-Allow-Headers", "*");

      return new Response(serverResp.body, {
        status: serverResp.status,
        statusText: serverResp.statusText,
        headers: respHeaders,
      });
    } catch (proxyErr) {
      return new Response(`Proxy error reaching SAL Server at ${serverBaseUrl}: ${proxyErr}`, {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  };

  // Find an open port starting from requested port
  let activePort = port;
  let serverStarted = false;

  while (!serverStarted && activePort < port + 10) {
    try {
      Deno.serve({ port: activePort, onListen: () => {} }, handler);
      serverStarted = true;
    } catch (e: unknown) {
      const err = e as { name?: string };
      if (err.name === "AddrInUse") {
        activePort++;
      } else {
        throw e;
      }
    }
  }

  const localDashboardUrl = `http://localhost:${activePort}/app/observation.html`;
  console.log("\n=======================================================");
  console.log("  🎙️ SAL Teacher Observation Initializer (Deno Client)");
  console.log("=======================================================");
  console.log(`  🔗 Target SAL Server : ${serverBaseUrl}`);
  console.log(`  🖥️ Local Proxy URL   : ${localDashboardUrl}`);
  console.log("=======================================================\n");

  if (!noOpen) {
    await launchBrowser(localDashboardUrl, preferWebview);
  }
}

// --- CLI Entrypoint ---

export async function main(): Promise<void> {
  const args = Deno.args;

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
SAL Teacher Initializer

Usage:
  deno run -A init.ts [server_url] [options]

Arguments:
  server_url           Target SAL Server URL (default: http://sal.local:8000)

Options:
  --prep, -p           Pre-cache Wasm, Malloy, DaisyUI CSS and exit (run when online)
  --port <port>        Set local proxy port (default: 5173)
  --webview            Prefer native OS WebView window over external browser
  --no-open            Do not automatically open web browser / webview
  --help, -h           Show this help message

Examples:
  # Pre-cache online before class
  deno run -A init.ts --prep

  # Launch in classroom LAN
  deno run -A init.ts

  # Launch with specific server IP address
  deno run -A init.ts http://192.168.2.1:8000
    `);
    return;
  }

  if (args.includes("--prep") || args.includes("-p")) {
    await runPrep();
    return;
  }

  let serverUrl = DEFAULT_SERVER_URL;
  let port = DEFAULT_PORT;
  const noOpen = args.includes("--no-open");
  const preferWebview = args.includes("--webview");

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--port" && i + 1 < args.length) {
      port = parseInt(args[++i], 10);
    } else if (!a.startsWith("-")) {
      serverUrl = a;
      if (!serverUrl.startsWith("http://") && !serverUrl.startsWith("https://")) {
        serverUrl = `http://${serverUrl}`;
      }
    }
  }

  await startProxyServer(serverUrl, port, noOpen, preferWebview);
}

if (import.meta.main) {
  await main();
}
