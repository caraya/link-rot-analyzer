import { fileURLToPath } from "node:url";
import path from "node:path";

export interface LiveVerificationResult {
  url: string;
  statusCode: number | null;
  statusText: string | null;
  finalUrl: string;
  isAlive: boolean; // status 200-299 or 304
  contentType: string | null;
  responseTimeMs: number;
  error: string | null;
  checkedAt: string;
}

const DEFAULT_USER_AGENT =
  "LinkRotAnalyzer/1.0 (Research Tool; +https://github.com/carlos/link-rot-analyzer)";

/**
 * Performs targeted, single-URL live HTTP status verification.
 * Uses a HEAD request first (with redirect following), falling back to GET
 * if HEAD is rejected or fails with 405/403/400 status codes.
 */
export async function verifyUrlLive(
  url: string,
  timeoutMs = 10000
): Promise<LiveVerificationResult> {
  const startTime = Date.now();
  const checkedAt = new Date().toISOString();

  let targetUrl = url;
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `http://${targetUrl}`;
  }

  const attemptFetch = async (method: "HEAD" | "GET"): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(targetUrl, {
        method,
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        redirect: "follow",
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    let response: Response;
    try {
      response = await attemptFetch("HEAD");
      // If HEAD is disallowed or returns client error, fallback to GET
      if (response.status === 405 || response.status === 403 || response.status === 400) {
        response = await attemptFetch("GET");
      }
    } catch {
      // Fallback to GET on network/HEAD error
      response = await attemptFetch("GET");
    }

    const responseTimeMs = Date.now() - startTime;
    const isAlive = (response.status >= 200 && response.status < 300) || response.status === 304;

    return {
      url: targetUrl,
      statusCode: response.status,
      statusText: response.statusText || null,
      finalUrl: response.url || targetUrl,
      isAlive,
      contentType: response.headers.get("content-type"),
      responseTimeMs,
      error: isAlive ? null : `HTTP ${response.status}: ${response.statusText}`,
      checkedAt,
    };
  } catch (err: unknown) {
    const responseTimeMs = Date.now() - startTime;
    let errorMessage = "Unknown network error";

    if (err instanceof Error) {
      if (err.name === "AbortError") {
        errorMessage = `Request timed out after ${timeoutMs}ms`;
      } else {
        errorMessage = err.message;
      }
    }

    return {
      url: targetUrl,
      statusCode: null,
      statusText: null,
      finalUrl: targetUrl,
      isAlive: false,
      contentType: null,
      responseTimeMs,
      error: errorMessage,
      checkedAt,
    };
  }
}

// Execute live verifier directly from CLI if provided a URL argument
const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const targetUrl = process.argv[2] || "https://example.com";
  console.log(`[Phase 3] Live Verifier checking: ${targetUrl}...`);
  verifyUrlLive(targetUrl).then((result) => {
    console.log(`[Phase 3] Live Verification Completed in ${result.responseTimeMs}ms`);
    console.table({
      URL: result.url,
      Alive: result.isAlive,
      Status: result.statusCode ?? "N/A",
      FinalURL: result.finalUrl,
      ResponseTimeMs: result.responseTimeMs,
      Error: result.error ?? "None",
    });
  });
}