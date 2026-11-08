import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from "expo-audio";
import { File } from "expo-file-system";
import { MAX_RECORDING_SECONDS, RECORDING_BIT_RATE, RECORDING_SAMPLE_INTERVAL_MS, RECORDING_WAVEFORM_BARS, formatRecordingDuration, recordingFileName, recordingLevel } from "@media-summarizer/core/media/audioRecording";
import { MAX_AUDIO_UPLOAD_SIZE_BYTES, type LocalUploadFile } from "@media-summarizer/core/types/upload";
import { BorderRadius, Spacing, TouchTarget, Typography, type Theme } from "../constants/theme";
import { useThemeColors, useThemedStyles } from "../contexts/ThemeContext";
import { getActiveLocale, t } from "../i18n";

type Phase = "starting" | "recording" | "paused" | "finished" | "error";
const OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: RECORDING_BIT_RATE,
  isMeteringEnabled: true,
  android: { ...RecordingPresets.HIGH_QUALITY.android, maxFileSize: MAX_AUDIO_UPLOAD_SIZE_BYTES },
};

/** The file only enters the ordinary intake after this modal has dismissed. */
export function AudioNoteRecorder({ onClose, onRecorded }: {
  onClose: () => void;
  onRecorded: (file: LocalUploadFile) => void;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const [visible, setVisible] = useState(true);
  const [phase, setPhase] = useState<Phase>("starting");
  const [message, setMessage] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [samples, setSamples] = useState<number[]>(Array(RECORDING_WAVEFORM_BARS).fill(0));
  const [date] = useState(() => new Date());
  const alive = useRef(true);
  const closing = useRef(false);
  const busy = useRef(false);
  const prepared = useRef(false);
  const handedOver = useRef<LocalUploadFile | null>(null);
  const fileUri = useRef<string | null>(null);
  const duration = useRef(0);
  const wasRecording = useRef(false);
  const recorder = useAudioRecorder(OPTIONS, (status) => {
    if (!alive.current || closing.current) return;
    if (status.url) fileUri.current = status.url;
    if (status.hasError || status.mediaServicesDidReset) {
      setMessage(t("recording.interrupted"));
      setPhase("finished");
    } else if (status.isFinished && !busy.current) {
      setMessage(t(duration.current >= MAX_RECORDING_SECONDS * 1000 ? "recording.limitReached" : "recording.interrupted"));
      setPhase("finished");
    }
  });
  useEffect(() => {
    const interval = setInterval(() => {
      if (!prepared.current || closing.current || busy.current) return;
      const state = recorder.getStatus();
      duration.current = Math.max(duration.current, state.durationMillis);
      setElapsed(duration.current);
      if (state.isRecording) {
        setSamples((old) => [...old.slice(1), recordingLevel(state.metering)]);
      } else if (wasRecording.current) {
        setPhase((current) => current === "recording" ? "paused" : current);
        setMessage(t("recording.interrupted"));
      }
      wasRecording.current = state.isRecording;
      if (state.isRecording && duration.current >= MAX_RECORDING_SECONDS * 1000) {
        busy.current = true;
        void recorder.stop().then(() => {
          if (!alive.current) return;
          wasRecording.current = false;
          setMessage(t("recording.limitReached"));
          setPhase("finished");
        }).catch(() => {
          if (alive.current) setMessage(t("recording.error"));
        }).finally(() => { busy.current = false; });
      }
    }, RECORDING_SAMPLE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [recorder]);

  useEffect(() => {
    alive.current = true;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active" || closing.current || !prepared.current) return;
      try {
        if (recorder.isRecording) {
          recorder.pause();
          wasRecording.current = false;
          setPhase("paused");
          setMessage(t("recording.interrupted"));
        }
      } catch {
        setMessage(t("recording.interrupted"));
        setPhase("finished");
      }
    });
    return () => {
      alive.current = false;
      subscription.remove();
      // The hook releases the native recorder (and microphone) on unmount.
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      if (!handedOver.current) removeFile(fileUri.current);
    };
  }, [recorder]);

  const start = async () => {
    if (busy.current || closing.current) return;
    busy.current = true;
    setPhase("starting");
    setMessage(null);
    setPermissionDenied(false);
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!alive.current || closing.current) return;
      if (!permission.granted) {
        setPermissionDenied(true);
        setMessage(t("recording.permission"));
        setPhase("error");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (!alive.current || closing.current) {
        await setAudioModeAsync({ allowsRecording: false });
        return;
      }
      await recorder.prepareToRecordAsync();
      prepared.current = true;
      fileUri.current = recorder.uri;
      if (!alive.current || closing.current) {
        await recorder.stop();
        return;
      }
      if (AppState.currentState !== "active") {
        setPhase("paused");
        setMessage(t("recording.interrupted"));
        return;
      }
      recorder.record();
      wasRecording.current = true;
      setPhase("recording");
    } catch {
      if (alive.current && !closing.current) {
        setMessage(t("recording.error"));
        setPhase("error");
      }
    } finally {
      if (!alive.current) {
        void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
        removeFile(fileUri.current);
      }
      busy.current = false;
    }
  };

  const toggle = () => {
    if (busy.current || closing.current) return;
    try {
      if (recorder.isRecording) {
        recorder.pause();
        wasRecording.current = false;
        setPhase("paused");
      } else {
        const remaining = MAX_RECORDING_SECONDS - elapsed / 1000;
        if (remaining <= 0) return;
        recorder.record();
        wasRecording.current = true;
        setPhase("recording");
      }
      setMessage(null);
    } catch {
      setMessage(t("recording.interrupted"));
      setPhase("finished");
    }
  };

  const dismissed = () => {
    const file = handedOver.current;
    if (file) onRecorded(file);
    else onClose();
  };
  const dismiss = () => {
    setVisible(false);
    // RN's onDismiss is iOS-only. Android does not present intake on the same
    // view controller, so it needs no deferred handover.
    if (Platform.OS !== "ios") dismissed();
  };
  const save = async () => {
    if (busy.current || closing.current || elapsed < 500) return;
    busy.current = true;
    try {
      if (phase !== "finished") await recorder.stop();
      const uri = recorder.uri ?? fileUri.current;
      if (!uri) throw new Error("no recording");
      fileUri.current = uri;
      const file = new File(uri);
      if (!file.exists || !file.size || file.size > MAX_AUDIO_UPLOAD_SIZE_BYTES) throw new Error("invalid recording");
      handedOver.current = {
        uri, name: recordingFileName(t("recording.filename"), date, "m4a"),
        mimeType: "audio/mp4", size: file.size, kind: "audio",
      };
      closing.current = true;
      await setAudioModeAsync({ allowsRecording: false });
      dismiss();
    } catch {
      handedOver.current = null;
      closing.current = false;
      setMessage(t("recording.error"));
      setPhase("finished");
    } finally {
      busy.current = false;
    }
  };
  const discard = async () => {
    if (busy.current || closing.current) return;
    closing.current = true;
    if (prepared.current) await recorder.stop().catch(() => {});
    removeFile(recorder.uri ?? fileUri.current);
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    dismiss();
  };
  const requestClose = () => {
    if (busy.current || closing.current) return;
    if (!prepared.current) { void discard(); return; }
    // Stop capturing while the discard question is on screen; cancel returns
    // to an explicit paused state rather than secretly extending the note.
    if (recorder.isRecording) toggle();
    Alert.alert(t("recording.discardTitle"), t("recording.discardBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("recording.discard"), style: "destructive", onPress: () => { void discard(); } },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onShow={() => { void start(); }} onRequestClose={requestClose} onDismiss={dismissed}>
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>{t("recording.title")}</Text>
          <Pressable style={styles.close} onPress={requestClose} accessibilityLabel={t("common.close")} accessibilityRole="button" disabled={phase === "starting"}>
            <Ionicons name="close" size={28} color={colors.textMain} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.waveform} accessible={false} importantForAccessibility="no-hide-descendants">
            {samples.map((sample, index) => <View key={index} style={[styles.bar, { height: Spacing.xs + sample * Spacing.xxl * 3 }]} />)}
          </View>
          <View style={styles.details}>
            <Text style={styles.date}>{date.toLocaleString(getActiveLocale(), { dateStyle: "medium", timeStyle: "short" })}</Text>
            <Text style={styles.timer} accessibilityLabel={formatRecordingDuration(elapsed)}>{formatRecordingDuration(elapsed)}</Text>
            <Text style={styles.status} accessibilityLiveRegion="polite">{t(`recording.${phase === "error" ? "title" : phase}`)}</Text>
            <View style={styles.controls}>
              {phase === "starting" ? <ActivityIndicator color={colors.primaryInk} /> : phase === "error" ? (
                <Pressable style={styles.primary} onPress={() => { void start(); }} accessibilityRole="button" accessibilityLabel={t("common.retry")}><Ionicons name="mic" size={28} color={colors.onPrimary} /></Pressable>
              ) : phase !== "finished" ? (
                <Pressable style={styles.primary} onPress={toggle} accessibilityRole="button" accessibilityLabel={t(phase === "recording" ? "recording.pause" : "recording.resume")}>
                  <Ionicons name={phase === "recording" ? "pause" : "play"} size={28} color={colors.onPrimary} />
                </Pressable>
              ) : null}
              <Pressable style={[styles.save, (phase === "starting" || phase === "error" || elapsed < 500) && styles.disabled]} onPress={() => { void save(); }} disabled={phase === "starting" || phase === "error" || elapsed < 500} accessibilityRole="button" accessibilityLabel={t("recording.save")}>
                <Ionicons name="checkmark" size={32} color={colors.textMain} />
              </Pressable>
            </View>
            {message && <Text style={styles.notice} accessibilityLiveRegion="polite">{message}</Text>}
            {permissionDenied && <Pressable style={styles.settings} onPress={() => { void Linking.openSettings().catch(() => {}); }} accessibilityRole="button" accessibilityLabel={t("recording.settings")}><Text style={styles.notice}>{t("recording.settings")}</Text></Pressable>}
            <Text style={styles.hint}>{t("recording.limit")}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function removeFile(uri: string | null) {
  if (!uri) return;
  try { const file = new File(uri); if (file.exists) file.delete(); } catch { /* Cache is also reclaimable by the OS. */ }
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.lg, gap: Spacing.md },
  title: { ...Typography.headline, color: colors.textMain, flex: 1 },
  close: { minWidth: TouchTarget.minimum, minHeight: TouchTarget.minimum, alignItems: "center", justifyContent: "center" },
  content: { flexGrow: 1, padding: Spacing.lg, gap: Spacing.xl },
  waveform: { flex: 1, minHeight: Spacing.xxl * 4, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.xs, overflow: "hidden" },
  bar: { flex: 1, maxWidth: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: colors.primaryInk },
  details: { alignItems: "center", gap: Spacing.md, paddingBottom: Spacing.lg },
  date: { ...Typography.label, color: colors.textSubtle, textAlign: "center" },
  timer: { ...Typography.display, color: colors.textMain, fontVariant: ["tabular-nums"], writingDirection: "ltr" },
  status: { ...Typography.label, color: colors.textSubtle },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.lg, paddingVertical: Spacing.lg },
  primary: { width: TouchTarget.large + Spacing.lg, height: TouchTarget.large + Spacing.lg, borderRadius: BorderRadius.full, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  save: { width: TouchTarget.large + Spacing.lg, height: TouchTarget.large + Spacing.lg, borderRadius: BorderRadius.full, backgroundColor: colors.surfaceContainerHigh, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.4 },
  notice: { ...Typography.body, color: colors.textSubtle, textAlign: "center" },
  settings: { minHeight: TouchTarget.minimum, justifyContent: "center", padding: Spacing.sm },
  hint: { ...Typography.small, color: colors.textSubtle, textAlign: "center" },
});
