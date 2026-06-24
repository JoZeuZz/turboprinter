// webui-react/src/components/ui/Textarea.tsx
import { forwardRef } from "react";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, className = "", ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-muted">{label}</label>
      )}
      <textarea
        ref={ref}
        className={`min-h-[80px] rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent resize-none disabled:opacity-50 ${className}`}
        {...props}
      />
    </div>
  )
);
Textarea.displayName = "Textarea";
