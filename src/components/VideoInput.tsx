import { useState } from "react";
import { extractVideoId } from "../utils/youtube";

interface Props {
  onLoad: (videoId: string) => void;
  loading?: boolean;
}

export default function VideoInput({ onLoad, loading }: Props) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractVideoId(url.trim());
    if (!id) {
      setError("Invalid YouTube URL");
      return;
    }
    setError("");
    onLoad(id);
  };

  return (
    <form className="video-input" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Paste YouTube URL..."
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setError("");
        }}
        disabled={loading}
      />
      <button type="submit" disabled={loading}>
        {loading ? "Loading..." : "Load"}
      </button>
      {error && <span className="error">{error}</span>}
    </form>
  );
}
