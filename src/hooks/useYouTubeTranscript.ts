import { useState, useCallback } from "react";

const API_BASE = "/api";

export interface TranscriptInfo {
  language: string;
  languageCode: string;
  isGenerated: boolean;
}

export interface TranscriptSnippet {
  text: string;
  start: number;
  duration: number;
}

export interface FetchedTranscript {
  snippets: TranscriptSnippet[];
  videoId: string;
  languageCode: string;
}

export function useYouTubeTranscript() {
  const [transcripts, setTranscripts] = useState<TranscriptInfo[]>([]);
  const [activeTranscript, setActiveTranscript] = useState<FetchedTranscript | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTranscriptList = useCallback(async (videoId: string) => {
    setLoading(true);
    setError(null);
    setTranscripts([]);
    setActiveTranscript(null);
    try {
      const res = await fetch(`${API_BASE}/transcripts/${videoId}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTranscripts(data.transcripts);
      return data.transcripts as TranscriptInfo[];
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch transcript list";
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTranscript = useCallback(
    async (videoId: string, languageCode: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/transcript/${videoId}/${languageCode}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setActiveTranscript(data);
        return data as FetchedTranscript;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to fetch transcript";
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    transcripts,
    activeTranscript,
    loading,
    error,
    fetchTranscriptList,
    fetchTranscript,
  };
}
