// webui-react/src/components/ui/Slider.tsx
interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  displayValue?: string;
  disabled?: boolean;
  disabledLabel?: string;
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 0.1,
  onChange,
  displayValue,
  disabled = false,
  disabledLabel,
}: SliderProps) {
  return (
    <div className={`flex flex-col gap-1 transition-opacity ${disabled ? "opacity-50 pointer-events-none select-none" : ""}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-foreground/60">{label}</label>
        <span className="text-xs text-foreground tabular-nums font-semibold">
          {disabled ? (disabledLabel ?? "N/A") : (displayValue ?? value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-border cursor-pointer accent-accent"
      />
    </div>
  );
}
