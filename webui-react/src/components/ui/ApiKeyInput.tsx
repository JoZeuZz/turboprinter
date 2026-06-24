import { useState } from "react";
import { Eye, EyeOff, Save } from "lucide-react";

interface ApiKeyInputProps {
  label: string;
  value: string;
  placeholder?: string;
  onSave: (value: string) => Promise<void>;
}

export function ApiKeyInput({ label, value, placeholder, onSave }: ApiKeyInputProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maskedDisplay = value ? "•".repeat(8) + value.slice(-4) : "(not set)";

  const handleEdit = () => {
    setDraft(value);
    setEditing(true);
    setSaved(false);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setSaved(true);
      setEditing(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted">{label}</label>
      {editing ? (
        <>
          <div className="flex items-center gap-1">
            <div className="relative flex-1">
              <input
                type={revealed ? "text" : "password"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={placeholder}
                className="h-8 w-full rounded border border-border bg-surface px-3 pr-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                type="button"
                onClick={() => setRevealed((r) => !r)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 rounded border border-border bg-surface px-2 py-1 text-xs text-accent hover:border-accent disabled:opacity-50"
            >
              <Save className="h-3 w-3" />
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded border border-border px-2 py-1 text-xs text-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
        </>
      ) : (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted">{maskedDisplay}</span>
          {saved && <span className="text-xs text-green-400">✓ Saved</span>}
          <button
            onClick={handleEdit}
            className="ml-auto text-xs text-accent hover:text-accent-hover"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
