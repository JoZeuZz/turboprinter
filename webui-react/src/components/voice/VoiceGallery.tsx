import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { voiceApi } from "../../api/voice";
import type { VoiceOption } from "../../api/types";

interface VoiceGalleryProps {
  voices: VoiceOption[];
  selectedVoice: string;
  voiceRate: number;
  voiceVolume: number;
  onSelect: (voice: string) => void;
}

interface VoiceCard {
  value: string;
  name: string;
  gender: "female" | "male" | "unknown";
  languageCode: string;
  languageLabel: string;
}

const PAGE_SIZE = 3;

const LANGUAGE_NAMES: Record<string, string> = {
  ar: "Árabe",
  de: "Alemán",
  en: "Inglés",
  es: "Español",
  fr: "Francés",
  hi: "Hindi",
  it: "Italiano",
  ja: "Japonés",
  ko: "Coreano",
  pt: "Portugués",
  ru: "Ruso",
  tr: "Turco",
  vi: "Vietnamita",
  zh: "Chino",
  multi: "Multilingüe",
};

const PREVIEW_TEXT: Record<string, string> = {
  ar: "هذا نص تجريبي لاختبار تحويل النص إلى كلام.",
  de: "Dies ist ein Beispieltext zum Testen der Sprachsynthese.",
  en: "This is an example text for testing speech synthesis.",
  es: "Este es un texto de ejemplo para probar la síntesis de voz.",
  fr: "Ceci est un exemple de texte pour tester la synthèse vocale.",
  hi: "यह वाक् संश्लेषण का परीक्षण करने के लिए एक उदाहरण पाठ है।",
  it: "Questo è un testo di esempio per provare la sintesi vocale.",
  ja: "これは音声合成をテストするためのサンプルテキストです。",
  ko: "음성 합성을 테스트하기 위한 예시 문장입니다.",
  pt: "Este é um texto de exemplo para testar a síntese de voz.",
  ru: "Это пример текста для проверки синтеза речи.",
  tr: "Bu, konuşma sentezini test etmek için örnek bir metindir.",
  vi: "Đây là văn bản mẫu để kiểm tra tính năng tổng hợp giọng nói.",
  zh: "这是一段用于测试语音合成的示例文本。",
  multi: "This is an example text for testing speech synthesis.",
};

function voiceMetadata(option: VoiceOption): VoiceCard {
  const raw = option.value;
  const gender = raw.endsWith("-Female")
    ? "female"
    : raw.endsWith("-Male")
      ? "male"
      : "unknown";
  const clean = raw
    .replace(/-Female$/, "")
    .replace(/-Male$/, "")
    .replace(/MultilingualNeural/g, "")
    .replace(/Neural/g, "")
    .replace(/-V2$/g, "");

  let languageCode = "multi";
  let locale = "";
  let name = option.label.replace(/\s*\((Female|Male)\)\s*$/i, "");

  if (raw.startsWith("siliconflow:")) {
    name = (raw.split(":").pop() ?? option.label).replace(/-(Female|Male)$/, "");
  } else if (raw.startsWith("gemini:") || raw.startsWith("mimo:")) {
    name = (raw.split(":").pop() ?? option.label).replace(/-(Female|Male)$/, "");
  } else {
    const match = clean.match(/^([a-z]{2})-([A-Z]{2})-(.+)$/);
    if (match) {
      languageCode = match[1].toLowerCase();
      locale = `${match[1]}-${match[2]}`;
      name = match[3];
    }
  }

  const languageBase = LANGUAGE_NAMES[languageCode] ?? (locale || "Desconocido");
  return {
    value: raw,
    name: name.replace(/_/g, " ").trim() || option.label,
    gender,
    languageCode,
    languageLabel: locale ? `${languageBase} - ${locale}` : languageBase,
  };
}

function previewText(languageCode: string): string {
  return PREVIEW_TEXT[languageCode] ?? PREVIEW_TEXT.multi;
}

export function VoiceGallery({
  voices,
  selectedVoice,
  voiceRate,
  voiceVolume,
  onSelect,
}: VoiceGalleryProps) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("all");
  const [gender, setGender] = useState("all");
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cards = useMemo(() => voices.map(voiceMetadata), [voices]);
  const languageOptions = useMemo(
    () => Array.from(new Set(cards.map((card) => card.languageCode))).sort(),
    [cards]
  );
  const selectedValue = selectedVoice || cards[0]?.value || "";
  const normalizedSearch = search.trim().toLowerCase();
  const visible = cards.filter((card) => {
    const matchesSearch =
      !normalizedSearch ||
      card.name.toLowerCase().includes(normalizedSearch) ||
      card.value.toLowerCase().includes(normalizedSearch);
    const matchesLanguage = language === "all" || card.languageCode === language;
    const matchesGender = gender === "all" || card.gender === gender;
    return matchesSearch && matchesLanguage && matchesGender;
  });
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = visible.slice(
    currentPage * PAGE_SIZE,
    currentPage * PAGE_SIZE + PAGE_SIZE
  );

  const playPreview = async (card: VoiceCard) => {
    setError(null);
    setPreviewing(card.value);
    try {
      audioRef.current?.pause();
      const blob = await voiceApi.previewVoice({
        voice_name: card.value,
        text: previewText(card.languageCode),
        voice_rate: voiceRate,
        voice_volume: voiceVolume,
      });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch {
      setError("No se pudo probar esta voz.");
    } finally {
      setPreviewing(null);
    }
  };

  if (!voices.length) {
    return (
      <p className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted">
        No hay voces disponibles para este proveedor.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[1fr_8rem_7rem] gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-foreground/60">Buscar voz</label>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder="Nombre o código"
            className="h-9 rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-foreground/60">Idioma</label>
          <select
            value={language}
            onChange={(event) => {
              setLanguage(event.target.value);
              setPage(0);
            }}
            className="h-9 rounded-md border border-border bg-surface-2 px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="all">Todos</option>
            {languageOptions.map((code) => (
              <option key={code} value={code}>
                {LANGUAGE_NAMES[code] ?? code}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-foreground/60">Sexo</label>
          <select
            value={gender}
            onChange={(event) => {
              setGender(event.target.value);
              setPage(0);
            }}
            className="h-9 rounded-md border border-border bg-surface-2 px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="all">Todos</option>
            <option value="female">Femenino</option>
            <option value="male">Masculino</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-foreground/60">Voz</label>
        <span className="text-[11px] text-muted">
          {currentPage + 1} / {totalPages}
        </span>
      </div>

      <div className="relative px-8">
        <button
          type="button"
          aria-label="Voces anteriores"
          disabled={currentPage === 0}
          onClick={() => setPage((value) => Math.max(0, value - 1))}
          className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-md border border-border bg-surface-2/95 p-1.5 text-foreground shadow-lg transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="grid grid-cols-3 gap-2">
          {pageItems.map((card) => {
            const isSelected = card.value === selectedValue;
            const isPreviewing = previewing === card.value;

            return (
              <article
                key={card.value}
                className={`flex min-h-[10.5rem] min-w-0 flex-col justify-between rounded-lg border bg-base p-3 transition duration-150 ${
                  isSelected
                    ? "border-[#39ff14] shadow-[0_0_0_1px_#39ff14,0_0_18px_rgba(57,255,20,0.3)] bg-[#39ff14]/[0.035]"
                    : "border-border hover:border-accent/70"
                }`}
              >
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-foreground" title={card.name}>
                    {card.name}
                  </h3>
                  <p className="mt-2 line-clamp-2 min-h-[2.25rem] text-[11px] leading-4 text-foreground/65">
                    {previewText(card.languageCode)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] text-foreground/80">
                      {card.gender === "female"
                        ? "Femenino"
                        : card.gender === "male"
                          ? "Masculino"
                          : "Sin especificar"}
                    </span>
                    <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] text-foreground/80">
                      {card.languageLabel}
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onSelect(card.value)}
                    className={`rounded-md border px-2 py-1.5 text-xs font-medium transition ${
                      isSelected
                        ? "border-[#39ff14]/60 bg-surface text-foreground"
                        : "border-border bg-surface-2 text-foreground hover:border-accent"
                    }`}
                  >
                    {isSelected ? "Seleccionada" : "Usar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void playPreview(card)}
                    disabled={isPreviewing}
                    className="inline-flex items-center justify-center rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs font-medium text-foreground transition hover:border-accent disabled:cursor-wait disabled:opacity-60"
                  >
                    <Play className="mr-1 h-3 w-3" />
                    {isPreviewing ? "..." : "Probar"}
                  </button>
                </div>
              </article>
            );
          })}

          {Array.from({ length: PAGE_SIZE - pageItems.length }).map((_, index) => (
            <div
              key={`voice-placeholder-${index}`}
              className="min-h-[10.5rem] rounded-lg border border-dashed border-border/60"
            />
          ))}
        </div>

        <button
          type="button"
          aria-label="Voces siguientes"
          disabled={currentPage >= totalPages - 1}
          onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}
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
              index === currentPage ? "bg-foreground/70" : "bg-foreground/20"
            }`}
          />
        ))}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
