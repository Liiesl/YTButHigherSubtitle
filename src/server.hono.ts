import { Hono } from "hono";
import { cors } from "hono/cors";
import { listTranscripts, fetchTranscript } from "./utils/youtube";

const app = new Hono();

app.use("/api/*", cors());

app.get("/api/transcripts/:videoId", async (c) => {
  const videoId = c.req.param("videoId");
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return c.json({ error: "Invalid video ID" });
  }

  try {
    const transcripts = await listTranscripts(videoId);
    return c.json({ transcripts });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to list transcripts";
    return c.json({ error: msg });
  }
});

app.get("/api/transcript/:videoId/:lang", async (c) => {
  const videoId = c.req.param("videoId");
  const lang = c.req.param("lang");
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return c.json({ error: "Invalid video ID" });
  }

  try {
    const transcript = await fetchTranscript(videoId, lang);
    return c.json({
      snippets: transcript.snippets.map((s) => ({
        text: s.text,
        start: s.start,
        duration: s.duration,
      })),
      videoId: transcript.videoId,
      languageCode: transcript.languageCode,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch transcript";
    return c.json({ error: msg });
  }
});

export default app;
