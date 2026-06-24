import { Film } from "lucide-react";

export function Editor() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="rounded-full bg-surface p-4 border border-border">
        <Film className="h-8 w-8 text-accent" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-foreground">Timeline Editor</h2>
        <p className="mt-1 text-sm text-muted max-w-xs">
          Manual clip editing with drag-and-drop timeline. Coming in Phase 3.
        </p>
      </div>
    </div>
  );
}
