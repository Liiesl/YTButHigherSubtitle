import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { join } from "path";
import { listTranscripts, fetchTranscript } from "./utils/youtube";

const DIST = join(import.meta.dir, "..", "dist");
const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

const app = new Elysia()
  .use(cors())
  .get("/api/transcripts/:videoId", async ({ params }) => {
    const { videoId } = params;
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return { error: "Invalid video ID" };
    }

    try {
      const transcripts = await listTranscripts(videoId);
      return { transcripts };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to list transcripts";
      return { error: msg };
    }
  })
  .get("/api/transcript/:videoId/:lang", async ({ params }) => {
    const { videoId, lang } = params;
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return { error: "Invalid video ID" };
    }

    try {
      const transcript = await fetchTranscript(videoId, lang);
      return {
        snippets: transcript.snippets.map((s) => ({
          text: s.text,
          start: s.start,
          duration: s.duration,
        })),
        videoId: transcript.videoId,
        languageCode: transcript.languageCode,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch transcript";
      return { error: msg };
    }
  })
  .get("/*", async ({ request }) => {
    const url = new URL(request.url);
    let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const fullPath = join(DIST, filePath);
    const file = Bun.file(fullPath);
    if (await file.exists()) {
      const ext = fullPath.slice(fullPath.lastIndexOf("."));
      return new Response(file, {
        headers: { "Content-Type": MIME[ext] || "application/octet-stream" },
      });
    }
    const index = Bun.file(join(DIST, "index.html"));
    return new Response(index, {
      headers: { "Content-Type": "text/html" },
    });
  })
  .listen(4200);

console.log(`Server running at http://localhost:${app.server?.port}`);
