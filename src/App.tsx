import { useState, useCallback, useEffect } from "react";
import VideoInput from "./components/VideoInput";
import LanguageSelector from "./components/LanguageSelector";
import VideoPlayer from "./components/VideoPlayer";
import SubtitleOverlay from "./components/SubtitleOverlay";
import SubtitleStyleControls, {
  defaultSubtitleStyle,
  type SubtitleStyle,
} from "./components/SubtitleStyleControls";
import { useYouTubeTranscript } from "./hooks/useYouTubeTranscript";

const STORAGE_KEY = "yt-subtitle-style";

function loadStyle(): SubtitleStyle {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultSubtitleStyle, ...JSON.parse(raw) };
  } catch {}
  return defaultSubtitleStyle;
}

export default function App() {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(loadStyle);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const {
    transcripts,
    activeTranscript,
    loading,
    error,
    fetchTranscriptList,
    fetchTranscript,
  } = useYouTubeTranscript();

  const handleLoad = useCallback(
    async (id: string) => {
      setVideoId(id);
      setSelectedLang("");
      const list = await fetchTranscriptList(id);
      if (list.length > 0) {
        const preferred = list.find((t) => t.languageCode === "en") ?? list[0];
        setSelectedLang(preferred.languageCode);
        await fetchTranscript(id, preferred.languageCode);
      }
    },
    [fetchTranscriptList, fetchTranscript]
  );

  const handleLangChange = useCallback(
    async (code: string) => {
      if (!videoId) return;
      setSelectedLang(code);
      await fetchTranscript(videoId, code);
    },
    [videoId, fetchTranscript]
  );

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.requestFullscreen?.();
      } else if (document.fullscreenElement) {
        document.exitFullscreen?.();
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
        if (document.fullscreenElement) document.exitFullscreen?.();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isFullscreen]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(subtitleStyle));
  }, [subtitleStyle]);

  return (
    <div className={`app${isFullscreen ? " fullscreen" : ""}`}>
      <aside className="left-panel">
        <header>
          <h1>YT Subtitle Positioner</h1>
          <p className="subtitle">Subtitles at 60% for vertical drama</p>
        </header>

        <VideoInput onLoad={handleLoad} loading={loading && !videoId} />

        {error && <div className="error-box">{error}</div>}

        {transcripts.length > 0 && (
          <LanguageSelector
            transcripts={transcripts}
            selected={selectedLang}
            onSelect={handleLangChange}
            loading={loading}
          />
        )}
      </aside>

      <main className="center-panel">
        {videoId ? (
          <div className="player-wrapper">
            <VideoPlayer videoId={videoId} onTimeUpdate={setCurrentTime} />
            <SubtitleOverlay
              transcript={activeTranscript}
              currentTime={currentTime}
              style={subtitleStyle}
            />
            <div className="debug-bar">
              {activeTranscript
                ? `${activeTranscript.snippets.length} subs loaded`
                : "no transcript"}{" "}
              &middot; {currentTime.toFixed(1)}s
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <p>Paste a YouTube URL to get started</p>
          </div>
        )}
      </main>

      <aside className="right-panel">
        <SubtitleStyleControls
          style={subtitleStyle}
          onChange={setSubtitleStyle}
        />
      </aside>

      <button
        className="fullscreen-btn"
        onClick={toggleFullscreen}
        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
      >
        {isFullscreen ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
          </svg>
        )}
      </button>
    </div>
  );
}
