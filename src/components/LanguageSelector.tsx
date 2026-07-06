import type { TranscriptInfo } from "../hooks/useYouTubeTranscript";

interface Props {
  transcripts: TranscriptInfo[];
  selected: string;
  onSelect: (code: string) => void;
  loading?: boolean;
}

export default function LanguageSelector({ transcripts, selected, onSelect, loading }: Props) {
  if (!transcripts.length) return null;

  return (
    <select
      className="lang-select"
      value={selected}
      onChange={(e) => onSelect(e.target.value)}
      disabled={loading}
    >
      <option value="" disabled>
        Select subtitle language
      </option>
      {transcripts.map((t) => (
        <option key={t.languageCode} value={t.languageCode}>
          {t.language} ({t.languageCode})
          {t.isGenerated ? " [auto]" : ""}
        </option>
      ))}
    </select>
  );
}
