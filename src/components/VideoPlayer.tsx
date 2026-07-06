import { useEffect, useRef, useCallback } from "react";

const IFRAME_API_URL = "https://www.youtube.com/iframe_api";

interface YT {
  Player: new (
    el: HTMLElement | string,
    opts: Record<string, unknown>
  ) => {
    getCurrentTime: () => number;
    destroy: () => void;
  };
}

function loadIframeApi(): Promise<YT> {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }
    const existing = document.querySelector(`script[src="${IFRAME_API_URL}"]`);
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = IFRAME_API_URL;
      document.head.appendChild(tag);
    }
    const check = setInterval(() => {
      if (window.YT && window.YT.Player) {
        clearInterval(check);
        resolve(window.YT);
      }
    }, 50);
  });
}

declare global {
  interface Window {
    YT?: YT;
  }
}

interface Props {
  videoId: string;
  onTimeUpdate: (time: number) => void;
}

export default function VideoPlayer({ videoId, onTimeUpdate }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<{ getCurrentTime: () => number; destroy: () => void } | null>(null);
  const rafRef = useRef<number>(0);

  const tick = useCallback(() => {
    if (playerRef.current) {
      onTimeUpdate(playerRef.current.getCurrentTime());
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [onTimeUpdate]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const YT = await loadIframeApi();
      if (!mounted || !containerRef.current) return;

      containerRef.current.innerHTML = "";

      const player = new YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          cc_load_policy: 0,
        },
        events: {
          onReady: () => {
            playerRef.current = player;
            rafRef.current = requestAnimationFrame(tick);
          },
        },
      });
    }

    init();

    return () => {
      mounted = false;
      cancelAnimationFrame(rafRef.current);
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
      }
      playerRef.current = null;
    };
  }, [videoId, tick]);

  return (
    <div className="video-container">
      <div ref={containerRef} className="video-player" />
    </div>
  );
}
