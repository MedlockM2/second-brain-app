import { useEffect, useState } from "react";
import type { ForecastRequest } from "@media-summarizer/core/api/entitlements";
import { forecastLine, watchForecast } from "@media-summarizer/core/budget/presentation";
import type { BudgetForecast } from "@media-summarizer/core/types/entitlements";
import { apiRequest } from "../api";
import { useI18n } from "../i18n/I18nProvider";

export function BudgetForecastNotice({ request = null }: { request?: ForecastRequest | null }) {
  useI18n();
  const key = JSON.stringify(request);
  const [result, setResult] = useState<{ key: string; value: BudgetForecast | null } | null>(null);
  useEffect(() => watchForecast(JSON.parse(key) as ForecastRequest | null, { apiRequest },
    (value) => setResult({ key, value })), [key]);
  const line = forecastLine(result?.key === key ? result.value : null);
  if (line === null) return null;
  return <p className="small subtle">{line}</p>;
}
