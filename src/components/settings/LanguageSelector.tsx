import { useTranslation } from "react-i18next";
import { Select } from "../ui/Select";

export function LanguageSelector() {
  const { t, i18n } = useTranslation();
  const current = i18n.language?.startsWith("en") ? "en" : "es";
  return (
    <Select
      label={t("settings.language")}
      value={current}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      options={[
        { value: "es", label: t("settings.languageEs") },
        { value: "en", label: t("settings.languageEn") },
      ]}
    />
  );
}
