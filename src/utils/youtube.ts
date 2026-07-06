// ─── Constants ───────────────────────────────────────────────────────────────

const WATCH_URL = "https://www.youtube.com/watch?v={videoId}";
const INNERTUBE_API_URL = "https://www.youtube.com/youtubei/v1/player?key={apiKey}";
const INNERTUBE_CONTEXT = {
  client: {
    clientName: "ANDROID",
    clientVersion: "20.10.38",
  },
};

const PLAYABILITY_STATUS = {
  OK: "OK",
  ERROR: "ERROR",
  LOGIN_REQUIRED: "LOGIN_REQUIRED",
} as const;

const PLAYABILITY_FAILED_REASON = {
  BOT_DETECTED: "Sign in to confirm you're not a bot",
  AGE_RESTRICTED: "This video may be inappropriate for some users.",
  VIDEO_UNAVAILABLE: "This video is unavailable",
} as const;

const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitterFactor: 0.5,
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

// ─── Error Classes ───────────────────────────────────────────────────────────

export class YouTubeTranscriptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YouTubeTranscriptError";
  }
}

export class VideoUnavailable extends YouTubeTranscriptError {
  constructor(videoId: string) {
    super(`Video is no longer available: ${videoId}`);
    this.name = "VideoUnavailable";
  }
}

export class VideoUnplayable extends YouTubeTranscriptError {
  reason: string | null;
  subreasons: string[];

  constructor(videoId: string, reason: string | null, subreasons: string[] = []) {
    const reasonText = reason || "No reason specified";
    const subText = subreasons.length
      ? "\nAdditional Details:\n" + subreasons.map((r) => ` - ${r}`).join("\n")
      : "";
    super(`Video is unplayable: ${reasonText}${subText}`);
    this.name = "VideoUnplayable";
    this.reason = reason;
    this.subreasons = subreasons;
  }
}

export class TranscriptsDisabled extends YouTubeTranscriptError {
  constructor(videoId: string) {
    super(`Subtitles are disabled for video: ${videoId}`);
    this.name = "TranscriptsDisabled";
  }
}

export class RequestBlocked extends YouTubeTranscriptError {
  constructor(videoId: string) {
    super(
      `YouTube is blocking requests for video ${videoId}. ` +
        "This usually means too many requests or requests from a cloud provider IP."
    );
    this.name = "RequestBlocked";
  }
}

export class IpBlocked extends YouTubeTranscriptError {
  constructor(videoId: string) {
    super(`IP blocked by YouTube for video ${videoId} (captcha detected)`);
    this.name = "IpBlocked";
  }
}

export class AgeRestricted extends YouTubeTranscriptError {
  constructor(videoId: string) {
    super(`Video is age-restricted: ${videoId}`);
    this.name = "AgeRestricted";
  }
}

export class RateLimitExceeded extends YouTubeTranscriptError {
  retryAfter?: number;

  constructor(videoId: string, retryAfter?: number) {
    const msg = retryAfter
      ? `Rate limited on video ${videoId}. Retry after ${retryAfter}s`
      : `Rate limited on video ${videoId}`;
    super(msg);
    this.name = "RateLimitExceeded";
    this.retryAfter = retryAfter;
  }
}

export class NetworkError extends YouTubeTranscriptError {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "NetworkError";
    this.code = code;
  }
}

export class TimeoutError extends NetworkError {
  constructor(url: string, timeoutMs: number) {
    super(`Request to ${url} timed out after ${timeoutMs}ms`, "ETIMEDOUT");
    this.name = "TimeoutError";
  }
}

export class ConnectionError extends NetworkError {
  constructor(url: string, code: string) {
    super(`Failed to connect to ${url}: ${code}`, code);
    this.name = "ConnectionError";
  }
}

export class YouTubeDataUnparsable extends YouTubeTranscriptError {
  constructor(videoId: string) {
    super(`Could not parse YouTube data for video ${videoId}`);
    this.name = "YouTubeDataUnparsable";
  }
}

export class InvalidVideoId extends YouTubeTranscriptError {
  constructor(videoId: string) {
    super(
      `Invalid video ID: "${videoId}". Pass the video ID (e.g. "dQw4w9WgXcQ"), not the URL.`
    );
    this.name = "InvalidVideoId";
  }
}

export class FailedToCreateConsentCookie extends YouTubeTranscriptError {
  constructor(videoId: string) {
    super(`Failed to create consent cookie for video ${videoId}`);
    this.name = "FailedToCreateConsentCookie";
  }
}

export class PoTokenRequired extends YouTubeTranscriptError {
  constructor(videoId: string) {
    super(
      `Video ${videoId} requires a PO Token to retrieve transcripts. ` +
        "This usually means YouTube is blocking automated access."
    );
    this.name = "PoTokenRequired";
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TranscriptSnippet {
  text: string;
  start: number;
  duration: number;
}

export interface TranscriptInfo {
  language: string;
  languageCode: string;
  isGenerated: boolean;
}

export interface FetchedTranscript {
  snippets: TranscriptSnippet[];
  videoId: string;
  languageCode: string;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterFactor: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const YOUTUBE_REGEX =
  /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export function extractVideoId(url: string): string | null {
  const match = url.match(YOUTUBE_REGEX);
  return match ? match[1] : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function unwrapHtml(html: string): string {
  return html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = parseInt(header, 10);
  if (!isNaN(seconds)) return seconds;
  const dateMs = Date.parse(header);
  if (!isNaN(dateMs)) {
    const secondsUntil = Math.ceil((dateMs - Date.now()) / 1000);
    return secondsUntil > 0 ? secondsUntil : undefined;
  }
  return undefined;
}

function isRetryableError(error: unknown): boolean {
  return (
    error instanceof RateLimitExceeded ||
    error instanceof NetworkError ||
    error instanceof RequestBlocked
  );
}

function calculateDelay(
  attempt: number,
  config: RetryConfig,
  retryAfterSeconds?: number
): number {
  if (retryAfterSeconds !== undefined && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, config.maxDelayMs);
  }
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  const jitter =
    cappedDelay * config.jitterFactor * (Math.random() * 2 - 1);
  return Math.min(
    Math.max(0, Math.floor(cappedDelay + jitter)),
    config.maxDelayMs
  );
}

function wrapNetworkError(error: unknown, url: string, videoId: string): never {
  if (error instanceof TypeError || (error instanceof Error && "code" in error)) {
    const err = error as Error & { code?: string };
    if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
      throw new TimeoutError(url, 10000);
    }
    if (
      err.code === "ECONNREFUSED" ||
      err.code === "ENOTFOUND" ||
      err.code === "ENETUNREACH"
    ) {
      throw new ConnectionError(url, err.code);
    }
    throw new NetworkError(`Request to ${url} failed: ${err.message}`, err.code);
  }
  if (error instanceof Response) {
    if (error.status === 429) {
      const retryAfter = parseRetryAfter(error.headers.get("retry-after"));
      throw new RateLimitExceeded(videoId, retryAfter);
    }
    throw new NetworkError(`Request to ${url} failed with status ${error.status}`);
  }
  if (error instanceof YouTubeTranscriptError) {
    throw error;
  }
  throw new NetworkError(
    `Request to ${url} failed: ${error instanceof Error ? error.message : String(error)}`
  );
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new TimeoutError(url, timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// ─── YouTubeTranscriptClient ─────────────────────────────────────────────────

export class YouTubeTranscriptClient {
  private retryConfig: RetryConfig;
  private consentCookie: string | null = null;

  constructor(retryConfig?: Partial<RetryConfig>) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  /**
   * Fetch the YouTube watch page HTML, handling GDPR consent if needed.
   */
  private async fetchVideoHtml(videoId: string): Promise<string> {
    let html = await this.fetchHtml(videoId);

    if (html.includes('action="https://consent.youtube.com/s"')) {
      this.createConsentCookie(html, videoId);
      html = await this.fetchHtml(videoId);
      if (html.includes('action="https://consent.youtube.com/s"')) {
        throw new FailedToCreateConsentCookie(videoId);
      }
    }

    return html;
  }

  /**
   * Fetch raw HTML from YouTube watch page.
   */
  private async fetchHtml(videoId: string): Promise<string> {
    const url = WATCH_URL.replace("{videoId}", videoId);
    const headers: Record<string, string> = {
      "User-Agent": USER_AGENT,
      "Accept-Language": "en-US",
    };
    if (this.consentCookie) {
      headers["Cookie"] = this.consentCookie;
    }

    try {
      const response = await fetchWithTimeout(url, { headers });
      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
          throw new RateLimitExceeded(videoId, retryAfter);
        }
        throw new NetworkError(
          `YouTube page request failed with status ${response.status}`,
          String(response.status)
        );
      }
      const html = await response.text();
      return unwrapHtml(html);
    } catch (error) {
      wrapNetworkError(error, url, videoId);
    }
  }

  /**
   * Create a consent cookie from the YouTube consent page.
   */
  private createConsentCookie(html: string, videoId: string): void {
    const match = html.match(/name="v" value="(.*?)"/);
    if (!match) {
      throw new FailedToCreateConsentCookie(videoId);
    }
    this.consentCookie = `CONSENT=YES+${match[1]}`;
  }

  /**
   * Extract the Innertube API key from the YouTube page HTML.
   */
  private extractInnertubeApiKey(html: string, videoId: string): string {
    const pattern = /"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/;
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
    if (html.includes('class="g-recaptcha"')) {
      throw new IpBlocked(videoId);
    }
    throw new YouTubeDataUnparsable(videoId);
  }

  /**
   * Fetch player data from the Innertube API.
   */
  private async fetchInnertubeData(
    videoId: string,
    apiKey: string
  ): Promise<Record<string, unknown>> {
    const url = INNERTUBE_API_URL.replace("{apiKey}", apiKey);
    try {
      const response = await fetchWithTimeout(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT,
        },
        body: JSON.stringify({
          context: INNERTUBE_CONTEXT,
          videoId,
        }),
      });
      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
          throw new RateLimitExceeded(videoId, retryAfter);
        }
        throw new NetworkError(
          `Innertube API request failed with status ${response.status}`,
          String(response.status)
        );
      }
      return (await response.json()) as Record<string, unknown>;
    } catch (error) {
      wrapNetworkError(error, url, videoId);
    }
  }

  /**
   * Assert that the video is playable.
   */
  private assertPlayability(
    playabilityStatus: Record<string, unknown> | undefined,
    videoId: string
  ): void {
    const status = playabilityStatus?.status as string | undefined;
    if (!status || status === PLAYABILITY_STATUS.OK) return;

    const reason = playabilityStatus?.reason as string | undefined;

    if (status === PLAYABILITY_STATUS.LOGIN_REQUIRED) {
      if (reason === PLAYABILITY_FAILED_REASON.BOT_DETECTED) {
        throw new RequestBlocked(videoId);
      }
      if (reason === PLAYABILITY_FAILED_REASON.AGE_RESTRICTED) {
        throw new AgeRestricted(videoId);
      }
    }

    if (status === PLAYABILITY_STATUS.ERROR) {
      if (reason === PLAYABILITY_FAILED_REASON.VIDEO_UNAVAILABLE) {
        throw new VideoUnavailable(videoId);
      }
    }

    const errorScreen =
      (playabilityStatus?.errorScreen as Record<string, unknown>) || {};
    const renderer =
      (errorScreen.playerErrorMessageRenderer as Record<string, unknown>) || {};
    const subreasonData =
      (renderer.subreason as Record<string, unknown>) || {};
    const runs = (subreasonData.runs as Array<Record<string, string>>) || [];
    const subreasons = runs.map((r) => r.text || "").filter(Boolean);

    throw new VideoUnplayable(videoId, reason ?? null, subreasons);
  }

  /**
   * Extract caption tracks from Innertube player data.
   */
  private extractCaptionsJson(
    innertubeData: Record<string, unknown>,
    videoId: string
  ): {
    captionTracks: Array<Record<string, unknown>>;
    translationLanguages: Array<Record<string, unknown>>;
  } {
    const playability = innertubeData.playabilityStatus as
      | Record<string, unknown>
      | undefined;
    this.assertPlayability(playability, videoId);

    const captions = innertubeData.captions as
      | Record<string, unknown>
      | undefined;
    const renderer = captions?.playerCaptionsTracklistRenderer as
      | Record<string, unknown>
      | undefined;
    const tracks = renderer?.captionTracks as
      | Array<Record<string, unknown>>
      | undefined;

    if (!tracks?.length) {
      throw new TranscriptsDisabled(videoId);
    }

    return {
      captionTracks: tracks,
      translationLanguages: (renderer?.translationLanguages as Array<Record<string, unknown>>) || [],
    };
  }

  /**
   * Build TranscriptInfo list from caption tracks.
   */
  private buildTranscriptList(
    videoId: string,
    captionTracks: Array<Record<string, unknown>>
  ): TranscriptInfo[] {
    return captionTracks.map((track) => {
      const nameRuns = track.name as Record<string, unknown> | undefined;
      const runs = nameRuns?.runs as Array<Record<string, string>> | undefined;
      const language = runs?.[0]?.text ?? (track.languageCode as string);
      return {
        language,
        languageCode: track.languageCode as string,
        isGenerated: track.kind === "asr",
      };
    });
  }

  /**
   * Fetch captions JSON with retry logic and exponential backoff.
   */
  private async fetchCaptionsJsonWithRetry(videoId: string): Promise<{
    captionTracks: Array<Record<string, unknown>>;
    translationLanguages: Array<Record<string, unknown>>;
  }> {
    const maxAttempts = this.retryConfig.maxRetries + 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const html = await this.fetchVideoHtml(videoId);
        const apiKey = this.extractInnertubeApiKey(html, videoId);
        const innertubeData = await this.fetchInnertubeData(videoId, apiKey);
        return this.extractCaptionsJson(innertubeData, videoId);
      } catch (error) {
        lastError = error;
        if (!isRetryableError(error) || attempt === maxAttempts - 1) {
          throw error;
        }
        const retryAfter =
          error instanceof RateLimitExceeded ? error.retryAfter : undefined;
        const delay = calculateDelay(attempt, this.retryConfig, retryAfter);
        await sleep(delay);
      }
    }

    throw lastError;
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * List available transcripts for a video.
   */
  async list(videoId: string): Promise<TranscriptInfo[]> {
    if (!videoId || typeof videoId !== "string") {
      throw new InvalidVideoId(String(videoId));
    }
    const trimmed = videoId.trim();
    if (trimmed === "") {
      throw new InvalidVideoId("");
    }
    if (
      trimmed.toLowerCase().includes("youtube.com") ||
      trimmed.toLowerCase().includes("youtu.be")
    ) {
      throw new InvalidVideoId(trimmed);
    }

    const { captionTracks } = await this.fetchCaptionsJsonWithRetry(trimmed);
    return this.buildTranscriptList(trimmed, captionTracks);
  }

  /**
   * Fetch a transcript for a specific language.
   */
  async fetch(
    videoId: string,
    languageCode = "en"
  ): Promise<FetchedTranscript> {
    if (!videoId || typeof videoId !== "string") {
      throw new InvalidVideoId(String(videoId));
    }
    const trimmed = videoId.trim();
    if (trimmed === "") {
      throw new InvalidVideoId("");
    }
    if (
      trimmed.toLowerCase().includes("youtube.com") ||
      trimmed.toLowerCase().includes("youtu.be")
    ) {
      throw new InvalidVideoId(trimmed);
    }

    const { captionTracks } = await this.fetchCaptionsJsonWithRetry(trimmed);

    const track =
      captionTracks.find((t) => t.languageCode === languageCode) ??
      captionTracks[0];

    if (!track?.baseUrl) {
      throw new YouTubeDataUnparsable(trimmed);
    }

    const cleanBaseUrl = (track.baseUrl as string).replace(/[&?]fmt=[^&]+/g, "");

    if (cleanBaseUrl.includes("&exp=xpe")) {
      throw new PoTokenRequired(trimmed);
    }

    const captionUrl = cleanBaseUrl + "&fmt=json3";
    let captionData: Record<string, unknown>;
    try {
      const response = await fetchWithTimeout(captionUrl);
      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
          throw new RateLimitExceeded(trimmed, retryAfter);
        }
        throw new NetworkError(
          `Caption request failed with status ${response.status}`,
          String(response.status)
        );
      }
      captionData = (await response.json()) as Record<string, unknown>;
    } catch (error) {
      wrapNetworkError(error, captionUrl, trimmed);
    }

    const snippets: TranscriptSnippet[] = [];
    const events = (captionData as Record<string, unknown>)?.events as
      | Array<Record<string, unknown>>
      | undefined;

    if (events) {
      for (const event of events) {
        const segs = event.segs as
          | Array<Record<string, string>>
          | undefined;
        if (!segs?.length) continue;

        const text = segs
          .map((s) => s.utf8 || "")
          .join("")
          .trim();
        if (!text || text === "\n") continue;

        const start = ((event.tStartMs as number) || 0) / 1000;
        const duration = ((event.dDurationMs as number) || 0) / 1000;
        snippets.push({ text, start, duration });
      }
    }

    return {
      snippets,
      videoId: trimmed,
      languageCode: track.languageCode as string,
    };
  }
}

// ─── Convenience Functions (same API as before) ──────────────────────────────

const defaultClient = new YouTubeTranscriptClient();

export async function listTranscripts(videoId: string): Promise<TranscriptInfo[]> {
  return defaultClient.list(videoId);
}

export async function fetchTranscript(
  videoId: string,
  languageCode: string
): Promise<FetchedTranscript> {
  return defaultClient.fetch(videoId, languageCode);
}
