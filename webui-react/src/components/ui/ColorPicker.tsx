// webui-react/src/components/ui/ColorPicker.tsx
interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-foreground/60">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-8 cursor-pointer rounded border border-border bg-surface-2 p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-24 rounded-md border border-border bg-surface-2 px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent font-mono"
        />
      </div>
    </div>
  );
}
