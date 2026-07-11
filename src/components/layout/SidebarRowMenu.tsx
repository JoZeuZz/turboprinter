import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SidebarRowMenuProps {
  label: string;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function SidebarRowMenu({ label, onRename, onDuplicate, onDelete }: SidebarRowMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setConfirming(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = (fn: () => void) => {
    fn();
    setOpen(false);
    setConfirming(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={t("sidebar.rowActions", { name: label })}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="rounded p-1 text-foreground/40 opacity-0 group-hover:opacity-100 hover:text-accent"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-36 rounded-md border border-border bg-surface py-1 shadow-lg">
          {confirming ? (
            <div className="px-3 py-1 text-[11px] text-foreground/70">
              <p className="mb-1">{t("sidebar.deleteConfirm", { name: label })}</p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  run(onDelete);
                }}
                className="text-red-400 hover:underline"
              >
                {t("common.confirm")}
              </button>
            </div>
          ) : (
            <>
              <MenuItem onClick={(e) => { e.stopPropagation(); run(onRename); }}>{t("common.rename")}</MenuItem>
              <MenuItem onClick={(e) => { e.stopPropagation(); run(onDuplicate); }}>{t("common.duplicate")}</MenuItem>
              <MenuItem onClick={(e) => { e.stopPropagation(); setConfirming(true); }}>{t("common.delete")}</MenuItem>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-surface-2"
    >
      {children}
    </button>
  );
}
