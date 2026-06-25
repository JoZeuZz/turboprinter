// webui-react/src/components/ui/Slider.tsx
interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  displayValue?: string;
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 0.1,
  onChange,
  displayValue,
}: SliderProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-foreground/60">{label}</label>
        <span className="text-xs text-foreground tabular-nums">
          {displayValue ?? value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-border cursor-pointer accent-accent"
      />
    </div>
  );
}
