import { useMemo } from "react";
import type { FetchedTranscript } from "../hooks/useYouTubeTranscript";
import type { SubtitleStyle } from "./SubtitleStyleControls";

function decodeHtml(html: string): string {
  const el = document.createElement("textarea");
  el.innerHTML = html;
  return el.value;
}

interface Props {
  transcript: FetchedTranscript | null;
  currentTime: number;
  style: SubtitleStyle;
}

export default function SubtitleOverlay({ transcript, currentTime, style }: Props) {
  const snippet = useMemo(() => {
    if (!transcript?.snippets) return null;
    const snippets = transcript.snippets;
    for (let i = snippets.length - 1; i >= 0; i--) {
      const s = snippets[i];
      if (currentTime >= s.start && currentTime < s.start + s.duration) {
        return s;
      }
    }
    return null;
  }, [transcript, currentTime]);

  if (!snippet) return null;

  const bgAlpha = style.bgOpacity / 100;
  const shadowAlpha = style.shadowOpacity / 100;

  return (
    <div
      className="subtitle-overlay"
      style={{ bottom: `${style.verticalPosition}%` }}
    >
      <span
        className="subtitle-text"
        style={{
          fontSize: `${style.fontSize}px`,
          fontWeight: style.fontWeight,
          borderRadius: `${style.borderRadius}px`,
          padding: `${style.padding}px 14px`,
          letterSpacing: `${style.letterSpacing}px`,
          color: style.textColor,
          background: `rgba(0, 0, 0, ${bgAlpha})`,
          backdropFilter: style.bgBlur > 0 ? `blur(${style.bgBlur}px)` : undefined,
          textShadow: style.shadowBlur > 0
            ? `0 2px ${style.shadowBlur}px rgba(0, 0, 0, ${shadowAlpha})`
            : "none",
        }}
      >
        {decodeHtml(snippet.text)}
      </span>
    </div>
  );
}
