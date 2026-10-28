/**
 * "Personnaliser": the step between a tile of the AI tab's "Generate" grid and
 * the generation it asks for (task-535, mockup
 * `mobile-design-mockups/ai_tab_notebooklm/`, section "Personnaliser").
 *
 *     [format icon]
 *     Customize the quiz                                         ×
 *     Number of questions   ( Fewer ) (✓ Standard (default)) ( More )
 *     Difficulty level      ( Easy ) (✓ Medium (default)) ( Hard )
 *     Prompt                [ What should the quiz focus on?      ]
 *     [            ✦ Generate            ]
 *
 * A full-screen modal over the media or folder page, opened with the scope and
 * the format in its route. Each format shows only the options the API accepts
 * for it (`formatOptionsOf`): the length for the summary, the number and the
 * difficulty for the flashcards and the quiz, nothing but the prompt for the
 * learning notes. Every option starts on its default, marked as such, so a
 * single tap on Generate asks for exactly what a tile asked for before this
 * screen existed — the same request, hence the same entry.
 *
 * Generate sends the request **and waits for its answer** before closing,
 * because a refusal has to be read where it was asked: a quota reached, a
 * folder with nothing readable, a `422` on the parameters all stay on this
 * screen, under the options, which keep the values that were refused. An
 * accepted request closes the screen onto the AI tab, where the entry it
 * created is already the generating row at the top of the list —
 * `ArtifactService.generateArtifact` folds it into the scope's history before
 * this screen goes. A `reused` answer means the very same generation already
 * exists: the screen closes and that artifact opens.
 *
 * The close button stays live while the request is out: leaving does not
 * cancel a generation the backend may already have queued, and the entry then
 * appears in the list like any other.
 *
 * Sources and language are added under these options by task-536.
 */

import { artifactForecast } from "@media-summarizer/core/api/entitlements";
import { BudgetForecastNotice } from "../../src/components/BudgetForecastNotice";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  sourceParameters,
  type ArtifactSource,
} from "@media-summarizer/core/artifacts/sources";
import {
  LOCALE_ENDONYMS,
  SUPPORTED_LOCALES,
} from "@media-summarizer/core/i18n/locales";
import { useUserPreferences } from "../../src/contexts/UserPreferencesContext";
import { ArtifactSourcePicker } from "../../src/components/ArtifactSourcePicker";
import { getArtifactSources } from "../../src/services/artifactSources";
import {
  DEFAULT_COUNT,
  DEFAULT_DIFFICULTY,
  DEFAULT_LENGTH,
  DIFFICULTIES,
  ITEM_COUNTS,
  MAX_FOCUS_CHARS,
  SUMMARY_LENGTHS,
  formatOptionsOf,
} from "@media-summarizer/core/artifacts/options";
import type {
  ArtifactGenerationParameters,
  ArtifactScope,
  Difficulty,
  ItemCount,
  SummaryLength,
} from "@media-summarizer/core/types/artifacts";
import type { ArtifactType } from "@media-summarizer/core/types/media";

import {
  HeaderIconButton,
  ScreenHeader,
} from "../../src/components/ScreenHeader";
import { KeyboardViewport, type KeyboardViewportHandle } from "../../src/components/KeyboardViewport";
import { useFocusedInputScroll } from "../../src/hooks/useFocusedInputScroll";
import {
  BorderRadius,
  Spacing,
  TouchTarget,
  Typography,
  type Theme,
} from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import {
  useThemeColors,
  useThemedStyles,
} from "../../src/contexts/ThemeContext";
import { describeArtifactRefusal } from "../../src/lib/artifactRefusal";
import {
  artifactFormatOf,
  type ArtifactFormat,
} from "../../src/lib/artifactFormats";
import { ArtifactService } from "../../src/services/artifactService";
import { t, useTranslation, type TranslationKey } from "../../src/i18n";

const LENGTH_LABELS: Record<SummaryLength, TranslationKey> = {
  short: "artifacts.customize.length.short",
  medium: "artifacts.customize.length.medium",
  long: "artifacts.customize.length.long",
};

const COUNT_LABELS: Record<ItemCount, TranslationKey> = {
  fewer: "artifacts.customize.count.fewer",
  standard: "artifacts.customize.count.standard",
  more: "artifacts.customize.count.more",
};

const DIFFICULTY_LABELS: Record<Difficulty, TranslationKey> = {
  easy: "artifacts.customize.difficulty.easy",
  medium: "artifacts.customize.difficulty.medium",
  hard: "artifacts.customize.difficulty.hard",
};

/** A deck counts cards, a quiz counts questions; the choices are the same. */
const COUNT_SECTION_LABELS: Partial<Record<ArtifactType, TranslationKey>> = {
  flashcards: "artifacts.customize.section.cardCount",
  quiz: "artifacts.customize.section.questionCount",
};

function readScope(value: string | undefined): ArtifactScope | null {
  return value === "media" || value === "folder" ? value : null;
}

export default function CustomizeArtifactScreen(): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  // Copy resolved on render: redraw when the interface language changes.
  useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    scope?: string;
    scopeId?: string;
    type?: string;
  }>();
  const scope = readScope(params.scope);
  const scopeId = params.scopeId ?? "";
  const format = params.type
    ? artifactFormatOf(params.type as ArtifactType)
    : undefined;

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/inbox");
  }, [router]);

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "bottom"]}
      testID="artifact-customize-screen"
    >
      {scope && scopeId && format ? (
        <CustomizeForm
          key={`${scope}:${scopeId}:${format.type}`}
          scope={scope}
          scopeId={scopeId}
          format={format}
          onClose={close}
        />
      ) : (
        // Only a malformed link lands here: nothing to customize, a way out.
        <ScreenHeader
          trailing={
            <HeaderIconButton
              icon="close"
              variant="plain"
              onPress={close}
              accessibilityLabel={t("common.close")}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

interface CustomizeFormProps {
  scope: ArtifactScope;
  scopeId: string;
  format: ArtifactFormat;
  onClose: () => void;
}

function CustomizeForm({
  scope,
  scopeId,
  format,
  onClose,
}: CustomizeFormProps): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { readingLanguage } = useUserPreferences();
  const mountedRef = useRef(true);
  const [language, setLanguage] = useState(readingLanguage);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [sources, setSources] = useState<ArtifactSource[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sourceError, setSourceError] = useState(false);
  const [sourceLoading, setSourceLoading] = useState(true);
  const loadSources = useCallback(async () => {
    setSourceLoading(true);
    setSourceError(false);
    try {
      const items = await getArtifactSources(scope, scopeId);
      if (!mountedRef.current) return;
      setSources(items);
      setSelected(new Set(items.map((item) => item.media_item_id)));
    } catch {
      if (mountedRef.current) setSourceError(true);
    } finally {
      if (mountedRef.current) setSourceLoading(false);
    }
  }, [scope, scopeId]);
  const viewportRef = useRef<KeyboardViewportHandle>(null);
  const promptRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const inputScroll = useFocusedInputScroll(scrollRef);
  useFocusEffect(useCallback(() => { viewportRef.current?.refresh(); }, []));
  const options = formatOptionsOf(format.type);
  const formatLabel = t(format.labelKey);
  const countSectionLabel = COUNT_SECTION_LABELS[format.type];

  const [length, setLength] = useState<SummaryLength>(DEFAULT_LENGTH);
  const [count, setCount] = useState<ItemCount>(DEFAULT_COUNT);
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_DIFFICULTY);
  const [focus, setFocus] = useState("");
  const [promptFocused, setPromptFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  // The ref makes a second tap a no-op on the frame it lands, before React has
  // redrawn the button as busy.
  const submittingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void loadSources(), 0);
    return () => clearTimeout(timer);
  }, [loadSources]);

  // Only the options this format takes: any other is a 422.
  const parameters = useMemo<ArtifactGenerationParameters>(() => {
    const value: ArtifactGenerationParameters = {
      focus,
      ...(sources ? sourceParameters(scope, sources, selected, language, readingLanguage) : {}),
    };
    if (options.includes("length")) value.length = length;
    if (options.includes("count")) value.count = count;
    if (options.includes("difficulty")) value.difficulty = difficulty;
    return value;
  }, [focus, sources, scope, selected, language, readingLanguage, options, length, count, difficulty]);

  const handleGenerate = useCallback(async () => {
    if (
      !isAuthenticated ||
      submittingRef.current ||
      sourceLoading ||
      sourceError ||
      !sources ||
      !selected.size
    )
      return;
    submittingRef.current = true;
    setSubmitting(true);
    setRefusal(null);
    Keyboard.dismiss();

    try {
      const result = await ArtifactService.generateArtifact(
        scope,
        scopeId,
        format.type,
        parameters,
      );
      // Closed meanwhile: the entry is in the list already, and opening an
      // artifact the user walked away from would be a surprise.
      if (!mountedRef.current) return;
      if (result.generation_outcome === "reused") {
        const artifactPath = `/artifacts/${result.artifact_id}` as const;
        if (router.canGoBack()) {
          router.back();
          router.push(artifactPath);
        } else {
          router.replace(artifactPath);
        }
        return;
      }
      // Still busy on purpose: the screen is leaving, and the button should not
      // flash back to "Generate" under the dismiss animation.
      onClose();
    } catch (err) {
      submittingRef.current = false;
      if (!mountedRef.current) return;
      setSubmitting(false);
      setRefusal(describeArtifactRefusal(err, { scope }));
    }
  }, [
    parameters,
    isAuthenticated,
    sourceLoading,
    sourceError,
    sources,
    selected,
    scope,
    scopeId,
    format.type,
    router,
    onClose,
  ]);

  return (
    <KeyboardViewport ref={viewportRef}>
      <ScreenHeader
        trailing={
          <HeaderIconButton
            icon="close"
            variant="plain"
            onPress={onClose}
            accessibilityLabel={t("common.close")}
            testID="artifact-customize-close"
          />
        }
      />

      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={false}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        onLayout={inputScroll.reveal}
        onContentSizeChange={inputScroll.reveal}
        onScroll={inputScroll.onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleBlock}>
          <View
            style={[
              styles.formatIcon,
              { backgroundColor: Colors[format.tint] },
            ]}
          >
            <Ionicons name={format.icon} size={28} color={Colors[format.ink]} />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {t(format.customizeTitleKey)}
          </Text>
        </View>

        {options.includes("length") ? (
          <ChoiceGroup
            label={t("artifacts.customize.section.length")}
            choices={SUMMARY_LENGTHS}
            value={length}
            defaultValue={DEFAULT_LENGTH}
            labelKeys={LENGTH_LABELS}
            onChange={setLength}
            disabled={submitting}
            testID="artifact-customize-length"
          />
        ) : null}

        {options.includes("count") && countSectionLabel ? (
          <ChoiceGroup
            label={t(countSectionLabel)}
            choices={ITEM_COUNTS}
            value={count}
            defaultValue={DEFAULT_COUNT}
            labelKeys={COUNT_LABELS}
            onChange={setCount}
            disabled={submitting}
            testID="artifact-customize-count"
          />
        ) : null}

        {options.includes("difficulty") ? (
          <ChoiceGroup
            label={t("artifacts.customize.section.difficulty")}
            choices={DIFFICULTIES}
            value={difficulty}
            defaultValue={DEFAULT_DIFFICULTY}
            labelKeys={DIFFICULTY_LABELS}
            onChange={setDifficulty}
            disabled={submitting}
            testID="artifact-customize-difficulty"
          />
        ) : null}

        <ArtifactSourcePicker
          sources={sources ?? []}
          selected={selected}
          loading={sourceLoading}
          error={sourceError}
          single={scope === "media"}
          disabled={submitting}
          onRetry={() => void loadSources()}
          onChange={setSelected}
        />

        <Text style={styles.sectionLabel}>
          {t("artifacts.customize.section.prompt")}
        </Text>
        <TextInput
          ref={promptRef}
          style={[styles.prompt, promptFocused && styles.promptFocused]}
          value={focus}
          onChangeText={setFocus}
          placeholder={t(format.promptHintKey)}
          placeholderTextColor={Colors.textMuted}
          multiline
          scrollEnabled
          textAlignVertical="top"
          // On the raw text: collapsing its whitespace before sending can only
          // shorten it, so the backend's ceiling is never crossed.
          maxLength={MAX_FOCUS_CHARS}
          editable={!submitting}
          onFocus={() => {
            setPromptFocused(true);
            inputScroll.focusInput(promptRef.current);
          }}
          onBlur={() => setPromptFocused(false)}
          accessibilityLabel={t("artifacts.customize.section.prompt")}
          accessibilityHint={t(format.promptHintKey)}
          testID="artifact-customize-prompt"
        />
        <Text style={styles.sectionLabel}>
          {t("artifacts.customize.language")}
        </Text>
        <Pressable
          style={styles.choice}
          onPress={() => setLanguageOpen((open) => !open)}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={t("artifacts.customize.language")}
          accessibilityState={{ expanded: languageOpen, disabled: submitting }}
        >
          <Ionicons name="language-outline" size={20} color={Colors.textMain} />
          <Text style={styles.choiceText}>
            {language && language in LOCALE_ENDONYMS
              ? language === readingLanguage
                ? t("artifacts.customize.defaultOption", {
                    label:
                      LOCALE_ENDONYMS[language as keyof typeof LOCALE_ENDONYMS],
                  })
                : LOCALE_ENDONYMS[language as keyof typeof LOCALE_ENDONYMS]
              : t("artifacts.customize.defaultOption", {
                  label: t("artifacts.customize.language"),
                })}
          </Text>
          <Ionicons name="chevron-down" size={18} color={Colors.textMain} />
        </Pressable>
        {languageOpen
          ? SUPPORTED_LOCALES.map((code) => (
              <Pressable
                key={code}
                style={[
                  styles.choice,
                  language === code && styles.choiceSelected,
                ]}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel={LOCALE_ENDONYMS[code]}
                accessibilityState={{
                  selected: language === code,
                  disabled: submitting,
                }}
                onPress={() => {
                  setLanguage(code);
                  setLanguageOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.choiceText,
                    language === code && styles.choiceTextSelected,
                  ]}
                >
                  {code === readingLanguage
                    ? t("artifacts.customize.defaultOption", {
                        label: LOCALE_ENDONYMS[code],
                      })
                    : LOCALE_ENDONYMS[code]}
                </Text>
              </Pressable>
            ))
          : null}
      </ScrollView>

      <View style={styles.footer}>
        <BudgetForecastNotice request={sources && selected.size && !sourceError ? artifactForecast(scope, scopeId, format.type, parameters) : null} />
        {refusal ? (
          <View
            style={styles.refusalBanner}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            testID="artifact-customize-refusal"
          >
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={Colors.error}
            />
            <Text style={styles.refusalText}>{refusal}</Text>
          </View>
        ) : null}
        <Pressable
          style={({ pressed }) => [
            styles.generateButton,
            pressed && !submitting && styles.generateButtonPressed,
          ]}
          onPress={() => void handleGenerate()}
          disabled={
            submitting || sourceLoading || sourceError || !selected.size
          }
          accessibilityLabel={t("artifacts.a11yGenerate", {
            label: formatLabel,
          })}
          accessibilityRole="button"
          accessibilityState={{
            busy: submitting,
            disabled:
              submitting || sourceLoading || sourceError || !selected.size,
          }}
          testID="artifact-customize-generate"
        >
          {submitting ? (
            <ActivityIndicator size="small" color={Colors.onPrimary} />
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color={Colors.onPrimary} />
              <Text style={styles.generateText}>
                {t("artifacts.customize.generate")}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </KeyboardViewport>
  );
}

interface ChoiceGroupProps<T extends string> {
  label: string;
  choices: readonly T[];
  value: T;
  defaultValue: T;
  labelKeys: Record<T, TranslationKey>;
  onChange: (value: T) => void;
  disabled: boolean;
  testID: string;
}

/**
 * One option: its name, then its values as pills that wrap. The chosen one is
 * filled in ink with a check; the default says so in its own label, so the
 * reader knows what a direct tap on Generate keeps.
 */
function ChoiceGroup<T extends string>({
  label,
  choices,
  value,
  defaultValue,
  labelKeys,
  onChange,
  disabled,
  testID,
}: ChoiceGroupProps<T>): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);

  return (
    <View>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.choices}>
        {choices.map((choice) => {
          const selected = choice === value;
          const choiceLabel =
            choice === defaultValue
              ? t("artifacts.customize.defaultOption", {
                  label: t(labelKeys[choice]),
                })
              : t(labelKeys[choice]);
          return (
            <Pressable
              key={choice}
              style={({ pressed }) => [
                styles.choice,
                selected && styles.choiceSelected,
                pressed && !selected && styles.choicePressed,
              ]}
              onPress={() => onChange(choice)}
              disabled={disabled}
              accessibilityLabel={choiceLabel}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              testID={`${testID}-${choice}`}
            >
              {selected ? (
                <Ionicons
                  name="checkmark"
                  size={16}
                  color={Colors.background}
                />
              ) : null}
              <Text
                style={[
                  styles.choiceText,
                  selected && styles.choiceTextSelected,
                ]}
              >
                {choiceLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    flex: {
      flex: 1,
    },
    body: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.lg,
    },
    // The format's tile, enlarged, over the title: the same tint and ink as in
    // the grid the reader just tapped, so the screen says which format it is
    // before the words do.
    titleBlock: {
      alignItems: "center",
      gap: Spacing.md,
      marginBottom: Spacing.sm,
    },
    formatIcon: {
      width: TouchTarget.comfortable,
      height: TouchTarget.comfortable,
      borderRadius: BorderRadius.xl,
      alignItems: "center",
      justifyContent: "center",
    },
    // The mockup's title is 26px bold; the scale has no such step, and the
    // display size (32px) breaks "Customize the flashcards" over two lines in
    // most languages. The headline size, in the display weight.
    title: {
      fontSize: Typography.headline.fontSize,
      fontWeight: Typography.display.fontWeight,
      color: Colors.textMain,
      textAlign: "center",
    },
    sectionLabel: {
      fontSize: Typography.body.fontSize,
      fontWeight: "600",
      color: Colors.textMain,
      marginTop: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    choices: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.sm,
    },
    // An unchosen value is drawn by its outline alone, as the mockup's pills
    // are: a fill would read as chosen. The chosen one is filled in ink, the
    // inverse of the page, which reads the same way in both modes.
    choice: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.xs,
      minHeight: TouchTarget.minimum,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.full,
      borderWidth: 1.5,
      borderColor: Colors.outlineVariant,
    },
    choiceSelected: {
      backgroundColor: Colors.textMain,
      borderColor: Colors.textMain,
    },
    choicePressed: {
      backgroundColor: Colors.surfaceContainerLow,
    },
    choiceText: {
      fontSize: Typography.label.fontSize,
      fontWeight: Typography.label.fontWeight,
      color: Colors.textMain,
    },
    choiceTextSelected: {
      color: Colors.background,
      fontWeight: "600",
    },
    // The field rule of `AuthField`: a quiet outline at rest, the amber ring
    // while the reader types in it. The ring grows outwards, so the text does
    // not shift on focus.
    prompt: {
      minHeight: Spacing.xxl * 2,
      maxHeight: Typography.body.lineHeight * 6 + Spacing.md * 2,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.md,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: Colors.outlineVariant,
      backgroundColor: Colors.surface,
      fontSize: Typography.body.fontSize,
      lineHeight: Typography.body.lineHeight,
      color: Colors.textMain,
    },
    promptFocused: {
      borderWidth: 2,
      borderColor: Colors.primary,
      margin: -1,
    },
    footer: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.md,
      gap: Spacing.md,
      backgroundColor: Colors.background,
    },
    refusalBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: Spacing.sm,
      backgroundColor: Colors.errorContainer,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
    },
    refusalText: {
      flex: 1,
      fontSize: Typography.small.fontSize,
      color: Colors.error,
      lineHeight: Typography.body.lineHeight,
    },
    generateButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.sm,
      minHeight: TouchTarget.comfortable,
      paddingHorizontal: Spacing.lg,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.primary,
    },
    // The same press feedback as the tiles that opened this screen.
    generateButtonPressed: {
      transform: [{ scale: 0.98 }],
      opacity: 0.9,
    },
    generateText: {
      fontSize: Typography.body.fontSize,
      fontWeight: "700",
      color: Colors.onPrimary,
    },
  });
