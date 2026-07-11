// webui-react/src/components/ui/Select.tsx
import { forwardRef, useId } from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, className = "", id, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? (label ? generatedId : undefined);
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={selectId} className="text-xs font-medium text-foreground/60">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`h-9 rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
);
Select.displayName = "Select";
