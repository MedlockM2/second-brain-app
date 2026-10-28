import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import type { ForecastRequest } from "@media-summarizer/core/api/entitlements";
import { forecastLine, watchForecast } from "@media-summarizer/core/budget/presentation";
import type { BudgetForecast } from "@media-summarizer/core/types/entitlements";
import { Typography, type Theme } from "../constants/theme";
import { useThemedStyles } from "../contexts/ThemeContext";
import { apiRequest } from "../services/apiClient";
import { useTranslation } from "../i18n";

/** Informational only: the primary action and the user's draft stay untouched. */
export function BudgetForecastNotice({ request = null }: { request?: ForecastRequest | null }): React.JSX.Element {
  useTranslation();
  const styles = useThemedStyles(makeStyles);
  const key = JSON.stringify(request);
  const [result, setResult] = useState<{ key: string; value: BudgetForecast | null } | null>(null);
  useEffect(() => watchForecast(JSON.parse(key) as ForecastRequest | null, { apiRequest },
    (value) => setResult({ key, value })), [key]);
  return <Text style={styles.text}>{forecastLine(result?.key === key ? result.value : null)}</Text>;
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  text: { ...Typography.small, color: colors.textSubtle },
});
