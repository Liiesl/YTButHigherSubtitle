export interface SubtitleStyle {
  verticalPosition: number;
  fontSize: number;
  bgOpacity: number;
  bgBlur: number;
  shadowBlur: number;
  shadowOpacity: number;
  textColor: string;
  fontWeight: string;
  borderRadius: number;
  padding: number;
  letterSpacing: number;
}

export const defaultSubtitleStyle: SubtitleStyle = {
  verticalPosition: 60,
  fontSize: 18,
  bgOpacity: 85,
  bgBlur: 0,
  shadowBlur: 4,
  shadowOpacity: 80,
  textColor: "#ffffff",
  fontWeight: "500",
  borderRadius: 6,
  padding: 8,
  letterSpacing: 0,
};

interface Props {
  style: SubtitleStyle;
  onChange: (style: SubtitleStyle) => void;
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="slider-row">
      <div className="slider-header">
        <span className="slider-label">{label}</span>
        <span className="slider-value">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="style-slider"
      />
    </div>
  );
}

const TEXT_COLORS = [
  "#ffffff",
  "#ffff00",
  "#00ffff",
  "#00ff00",
  "#ff8800",
  "#ff44ff",
  "#88aaff",
];

export default function SubtitleStyleControls({ style, onChange }: Props) {
  const set = <K extends keyof SubtitleStyle>(key: K, value: SubtitleStyle[K]) =>
    onChange({ ...style, [key]: value });

  return (
    <div className="style-controls">
      <h3>Subtitle Style</h3>

      <SliderRow
        label="Vertical Position"
        value={style.verticalPosition}
        min={5}
        max={90}
        step={1}
        unit="%"
        onChange={(v) => set("verticalPosition", v)}
      />

      <SliderRow
        label="Font Size"
        value={style.fontSize}
        min={12}
        max={60}
        step={1}
        unit="px"
        onChange={(v) => set("fontSize", v)}
      />

      <SliderRow
        label="Background Opacity"
        value={style.bgOpacity}
        min={0}
        max={100}
        step={1}
        unit="%"
        onChange={(v) => set("bgOpacity", v)}
      />

      <SliderRow
        label="Background Blur"
        value={style.bgBlur}
        min={0}
        max={20}
        step={1}
        unit="px"
        onChange={(v) => set("bgBlur", v)}
      />

      <SliderRow
        label="Shadow Blur"
        value={style.shadowBlur}
        min={0}
        max={20}
        step={1}
        unit="px"
        onChange={(v) => set("shadowBlur", v)}
      />

      <SliderRow
        label="Shadow Opacity"
        value={style.shadowOpacity}
        min={0}
        max={100}
        step={1}
        unit="%"
        onChange={(v) => set("shadowOpacity", v)}
      />

      <SliderRow
        label="Border Radius"
        value={style.borderRadius}
        min={0}
        max={20}
        step={1}
        unit="px"
        onChange={(v) => set("borderRadius", v)}
      />

      <SliderRow
        label="Padding"
        value={style.padding}
        min={0}
        max={20}
        step={1}
        unit="px"
        onChange={(v) => set("padding", v)}
      />

      <SliderRow
        label="Letter Spacing"
        value={style.letterSpacing}
        min={0}
        max={4}
        step={0.5}
        unit="px"
        onChange={(v) => set("letterSpacing", v)}
      />

      <div className="control-group">
        <span className="slider-label">Text Color</span>
        <div className="color-presets">
          {TEXT_COLORS.map((c) => (
            <button
              key={c}
              className={`color-swatch${style.textColor === c ? " active" : ""}`}
              style={{ background: c }}
              onClick={() => set("textColor", c)}
            />
          ))}
        </div>
      </div>

      <div className="control-group">
        <span className="slider-label">Font Weight</span>
        <div className="weight-buttons">
          <button
            className={`weight-btn${style.fontWeight === "400" ? " active" : ""}`}
            onClick={() => set("fontWeight", "400")}
          >
            Normal
          </button>
          <button
            className={`weight-btn${style.fontWeight === "bold" ? " active" : ""}`}
            onClick={() => set("fontWeight", "bold")}
          >
            Bold
          </button>
        </div>
      </div>
    </div>
  );
}
