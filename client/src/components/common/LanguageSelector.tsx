import React from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1">
      <Button
        size="sm"
        variant={language === "en" ? "default" : "ghost"}
        className="h-7 px-2 text-xs"
        onClick={() => setLanguage("en")}
      >
        EN
      </Button>
      <Button
        size="sm"
        variant={language === "hi" ? "default" : "ghost"}
        className="h-7 px-2 text-xs"
        onClick={() => setLanguage("hi")}
      >
        हि
      </Button>
      <span className="px-1 text-[11px] text-muted-foreground hidden sm:inline">
        {t("lang.label")}
      </span>
    </div>
  );
}

