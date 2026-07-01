import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface SubtitleFont {
  value: string;
  label: string;
  family: string;
  previewSize?: string;
}

interface SubtitleFontGalleryProps {
  value: string;
  onChange: (value: string) => void;
}

const FONTS: SubtitleFont[] = [
  {
    value: "STHeitiMedium.ttc",
    label: "STHeitiMedium",
    family: "STHeiti Medium Preview",
  },
  {
    value: "STHeitiLight.ttc",
    label: "STHeitiLight",
    family: "STHeiti Light Preview",
  },
  {
    value: "MicrosoftYaHeiBold.ttc",
    label: "MicrosoftYaHeiBold",
    family: "Microsoft YaHei Bold Preview",
    previewSize: "1.08rem",
  },
  {
    value: "MicrosoftYaHeiNormal.ttc",
    label: "MicrosoftYaHeiNormal",
    family: "Microsoft YaHei Normal Preview",
    previewSize: "1.02rem",
  },
  {
    value: "Charm-Bold.ttf",
    label: "Charm-Bold",
    family: "Charm Bold Preview",
    previewSize: "1.55rem",
  },
  {
    value: "Charm-Regular.ttf",
    label: "Charm-Regular",
    family: "Charm Regular Preview",
    previewSize: "1.45rem",
  },
  {
    value: "UTM Kabel KT.ttf",
    label: "UTM Kabel KT",
    family: "UTM Kabel Preview",
    previewSize: "1.35rem",
  },
];

const PAGE_SIZE = 3;

export function SubtitleFontGallery({
  value,
  onChange,
}: SubtitleFontGalleryProps) {
  const selectedValue = value || "STHeitiMedium.ttc";
  const initialPage = Math.max(
    0,
    Math.floor(
      Math.max(
        0,
        FONTS.findIndex((font) => font.value === selectedValue)
      ) / PAGE_SIZE
    )
  );
  const [page, setPage] = useState(initialPage);

  const totalPages = Math.ceil(FONTS.length / PAGE_SIZE);
  const visibleFonts = useMemo(
    () => FONTS.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [page]
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-foreground/60">Font</label>
        <span className="text-[11px] text-muted">
          {page + 1} / {totalPages}
        </span>
      </div>

      <div className="relative px-8">
        <button
          type="button"
          aria-label="Previous fonts"
          disabled={page === 0}
          onClick={() => setPage((current) => Math.max(0, current - 1))}
          className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-md border border-border bg-surface-2/95 p-1.5 text-foreground shadow-lg transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="grid grid-cols-3 gap-2">
          {visibleFonts.map((font) => {
            const isSelected = font.value === selectedValue;

            return (
              <button
                type="button"
                key={font.value}
                aria-pressed={isSelected}
                onClick={() => onChange(font.value)}
                className={`min-w-0 min-h-[8rem] rounded-lg border bg-base px-2 py-3 text-left transition duration-150 ${
                  isSelected
                    ? "border-[#39ff14] shadow-[0_0_0_1px_#39ff14,0_0_18px_rgba(57,255,20,0.32)] bg-[#39ff14]/[0.035]"
                    : "border-border hover:border-accent/70 hover:bg-surface"
                }`}
              >
                <div className="flex h-full min-w-0 flex-col items-center justify-between gap-3">
                  <div
                    className="flex min-h-[4rem] w-full min-w-0 items-center justify-center overflow-hidden text-center leading-tight text-foreground"
                    style={{
                      fontFamily: `"${font.family}", sans-serif`,
                      fontSize: font.previewSize ?? "1.14rem",
                    }}
                    title={font.label}
                  >
                    <span className="block w-full truncate">{font.label}</span>
                  </div>
                  <div className="w-full min-w-0">
                    <div className="truncate text-center text-[10px] text-foreground/60">
                      {font.label}
                    </div>
                    <div
                      className={`mt-2 truncate rounded-md border px-2 py-1.5 text-center text-[11px] font-medium ${
                        isSelected
                          ? "border-[#39ff14]/60 bg-surface text-foreground"
                          : "border-border bg-surface-2 text-foreground"
                      }`}
                    >
                      {isSelected ? "Selected" : "Use"}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          {Array.from({ length: PAGE_SIZE - visibleFonts.length }).map((_, index) => (
            <div
              key={`font-placeholder-${index}`}
              className="min-h-[8rem] rounded-lg border border-dashed border-border/60"
            />
          ))}
        </div>

        <button
          type="button"
          aria-label="Next fonts"
          disabled={page >= totalPages - 1}
          onClick={() =>
            setPage((current) => Math.min(totalPages - 1, current + 1))
          }
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-md border border-border bg-surface-2/95 p-1.5 text-foreground shadow-lg transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex justify-center gap-1">
        {Array.from({ length: totalPages }).map((_, index) => (
          <span
            key={index}
            className={`h-1.5 w-1.5 rounded-full ${
              index === page ? "bg-foreground/70" : "bg-foreground/20"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
