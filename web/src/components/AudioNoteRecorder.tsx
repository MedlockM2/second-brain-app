import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_RECORDING_SECONDS, RECORDING_BIT_RATE, RECORDING_SAMPLE_INTERVAL_MS, RECORDING_WAVEFORM_BARS, formatRecordingDuration, recordingFileName, recordingLevel } from "@media-summarizer/core/media/audioRecording";
import { MAX_AUDIO_UPLOAD_SIZE_BYTES } from "@media-summarizer/core/types/upload";
import { useI18n } from "../i18n/I18nProvider";
import { Icon } from "./Icon";

type Phase = "starting" | "recording" | "paused" | "finished" | "error";
/** Native encodings only: never relabel WebM bytes as an M4A file. */
const FORMATS = [
  { mime: "audio/webm;codecs=opus", extension: "webm" },
  { mime: "audio/mp4", extension: "m4a" },
  { mime: "audio/ogg;codecs=opus", extension: "ogg" },
];

export function AudioNoteRecorder({ onClose, onRecorded }: {
  onClose: () => void;
  onRecorded: (file: File) => void;
}) {
  const { t, locale } = useI18n();
  const [phase, setPhase] = useState<Phase>("starting");
  const [message, setMessage] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [samples, setSamples] = useState<number[]>(Array(RECORDING_WAVEFORM_BARS).fill(0));
  const [discarding, setDiscarding] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [date] = useState(() => new Date());
  const session = useRef<{
    recorder: MediaRecorder; stream: MediaStream; context: AudioContext | null;
    timer: number; started: number; duration: number; active: boolean; file: File | null;
    chunks: Blob[]; bytes: number; save: boolean; stopping: boolean;
  } | null>(null);
  const dialog = useRef<HTMLElement>(null);
  const resultHandler = useRef(onRecorded);
  useEffect(() => { resultHandler.current = onRecorded; }, [onRecorded]);
  const stop = useCallback((save: boolean) => {
    const current = session.current;
    if (!current || current.stopping) return;
    if (current.file) {
      if (save) resultHandler.current(current.file);
      return;
    }
    current.save = save;
    current.stopping = true;
    if (current.active) {
      current.duration += performance.now() - current.started;
      current.active = false;
    }
    setElapsed(current.duration);
    if (current.recorder.state !== "inactive") current.recorder.stop();
    current.stream.getTracks().forEach((track) => track.stop());
    window.clearInterval(current.timer);
    void current.context?.close().catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("unavailable");
        const format = FORMATS.find(({ mime }) => MediaRecorder.isTypeSupported(mime));
        if (!format) throw new Error("unsupported recorder");
        stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 }, video: false });
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
        const recorder = new MediaRecorder(stream, { mimeType: format.mime, audioBitsPerSecond: RECORDING_BIT_RATE });
        let analyser: AnalyserNode | null = null;
        // Metering failure must not prevent an otherwise supported recording.
        try {
          context = new AudioContext();
          await context.resume();
          if (cancelled) { void context.close(); stream.getTracks().forEach((track) => track.stop()); return; }
          analyser = context.createAnalyser();
          analyser.fftSize = 256;
          context.createMediaStreamSource(stream).connect(analyser);
        } catch { if (context) void context.close().catch(() => {}); context = null; }
        const current = { recorder, stream, context, timer: 0, started: performance.now(), duration: 0, active: true, file: null as File | null, chunks: [] as Blob[], bytes: 0, save: false, stopping: false };
        session.current = current;
        recorder.ondataavailable = ({ data }) => {
          if (cancelled || !data.size) return;
          current.chunks.push(data);
          current.bytes += data.size;
          if (current.bytes >= MAX_AUDIO_UPLOAD_SIZE_BYTES - 1024 * 1024 && !current.stopping) {
            setMessage(t("recording.limitReached"));
            stop(false);
          }
        };
        recorder.onstop = () => {
          if (cancelled) return;
          if (current.active) {
            current.duration += performance.now() - current.started;
            current.active = false;
            setElapsed(current.duration);
          }
          current.stopping = true;
          current.stream.getTracks().forEach((track) => track.stop());
          window.clearInterval(current.timer);
          void current.context?.close().catch(() => {});
          const blob = new Blob(current.chunks, { type: recorder.mimeType });
          current.chunks = [];
          if (!blob.size || blob.size > MAX_AUDIO_UPLOAD_SIZE_BYTES || current.duration < 500) {
            setMessage(t("recording.error"));
            setPhase("error");
            return;
          }
          current.file = new File([blob], recordingFileName(t("recording.filename"), date, format.extension), { type: blob.type });
          setPhase("finished");
          if (current.save) resultHandler.current(current.file);
        };
        recorder.onerror = () => {
          if (cancelled) return;
          setMessage(t("recording.interrupted"));
          stop(false);
        };
        stream.getAudioTracks().forEach((track) => track.addEventListener("ended", () => {
          if (cancelled || current.stopping) return;
          setMessage(t("recording.interrupted"));
          stop(false);
        }));
        recorder.start(1000);
        if (document.hidden) {
          recorder.pause();
          current.active = false;
          setPhase("paused");
          setMessage(t("recording.interrupted"));
        } else setPhase("recording");
        const values = new Uint8Array(256);
        current.timer = window.setInterval(() => {
          if (recorder.state !== "recording" || current.stopping) return;
          const duration = current.duration + performance.now() - current.started;
          setElapsed(duration);
          if (duration >= MAX_RECORDING_SECONDS * 1000) {
            setMessage(t("recording.limitReached"));
            stop(false);
            return;
          }
          let level = 0;
          if (analyser) {
            analyser.getByteTimeDomainData(values);
            const power = values.reduce((sum, sample) => sum + ((sample - 128) / 128) ** 2, 0) / values.length;
            level = recordingLevel(20 * Math.log10(Math.sqrt(power)));
          }
          setSamples((old) => [...old.slice(1), level]);
        }, RECORDING_SAMPLE_INTERVAL_MS);
      } catch (error) {
        stream?.getTracks().forEach((track) => track.stop());
        void context?.close().catch(() => {});
        if (!cancelled) {
          setMessage(t(error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError") ? "recording.permission" : "recording.error"));
          setPhase("error");
        }
      }
    };
    void start();
    return () => {
      cancelled = true;
      const current = session.current;
      if (current) {
        current.recorder.ondataavailable = null;
        current.recorder.onstop = null;
        current.recorder.onerror = null;
        if (current.recorder.state !== "inactive") current.recorder.stop();
        current.stream.getTracks().forEach((track) => track.stop());
        window.clearInterval(current.timer);
        void current.context?.close().catch(() => {});
      }
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close().catch(() => {});
      session.current = null;
    };
  }, [attempt, date, stop, t]);

  const pause = useCallback(() => {
    const current = session.current;
    if (!current || current.stopping || current.recorder.state !== "recording") return;
    current.duration += performance.now() - current.started;
    current.recorder.pause();
    current.active = false;
    setElapsed(current.duration);
    setPhase("paused");
  }, []);
  const resume = () => {
    const current = session.current;
    if (!current || current.stopping || current.recorder.state !== "paused") return;
    current.started = performance.now();
    current.active = true;
    current.recorder.resume();
    setPhase("recording");
    setMessage(null);
  };
  const discard = () => {
    const current = session.current;
    if (current) {
      current.save = false;
      current.recorder.ondataavailable = null;
      current.recorder.onstop = null;
      current.recorder.onerror = null;
      if (current.recorder.state !== "inactive") current.recorder.stop();
      current.stream.getTracks().forEach((track) => track.stop());
      window.clearInterval(current.timer);
      void current.context?.close().catch(() => {});
    }
    onClose();
  };
  const requestClose = useCallback(() => {
    if (!session.current || phase === "starting") { onClose(); return; }
    pause();
    setDiscarding(true);
  }, [onClose, pause, phase]);

  useEffect(() => {
    const visibility = () => {
      if (!document.hidden) return;
      pause();
      setMessage(t("recording.interrupted"));
    };
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (discarding) setDiscarding(false);
        else requestClose();
      }
      if (event.key !== "Tab") return;
      const root = dialog.current;
      const scope = root?.querySelector('[role="alertdialog"]') ?? root;
      const buttons = scope?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || !scope?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !scope?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("keydown", key);
    };
  }, [discarding, pause, requestClose, t]);

  return (
    <div className="scrim" onClick={requestClose} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); }}>
      <section ref={dialog} className="dialog audio-recorder" role="dialog" aria-modal="true" aria-label={t("recording.title")} onClick={(event) => event.stopPropagation()}>
        <div className="recording-surface" inert={discarding}>
        <div className="row">
          <h2 className="headline grow">{t("recording.title")}</h2>
          <button type="button" className="icon-btn" aria-label={t("common.close")} onClick={requestClose} autoFocus><Icon name="close" /></button>
        </div>
        <div className="recording-waveform" aria-hidden="true">
          {samples.map((sample, index) => <span key={index} style={{ height: 4 + sample * 144 }} />)}
        </div>
        <div className="recording-details">
          <p className="small subtle">{date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</p>
          <p className="display recording-timer" dir="ltr">{formatRecordingDuration(elapsed)}</p>
          <p className="small subtle" role="status">{t(`recording.${phase === "error" ? "title" : phase}`)}</p>
          <div className="recording-controls">
            {phase === "error" ? <button type="button" className="recording-control primary" aria-label={t("common.retry")} onClick={() => { setElapsed(0); setPhase("starting"); setMessage(null); setAttempt((value) => value + 1); }}><Icon name="mic-outline" size={24} /></button> : phase !== "finished" && (
              <button type="button" className="recording-control primary" disabled={phase === "starting"} aria-label={t(phase === "recording" ? "recording.pause" : "recording.resume")} onClick={phase === "recording" ? pause : resume}><Icon name={phase === "recording" ? "pause" : "play"} size={24} /></button>
            )}
            <button type="button" className="recording-control" disabled={phase === "starting" || phase === "error" || elapsed < 500} aria-label={t("recording.save")} onClick={() => {
              if (session.current?.file) resultHandler.current(session.current.file);
              else stop(true);
            }}><Icon name="checkmark" size={24} /></button>
          </div>
          {message && <p className="small subtle" role="status">{message}</p>}
          <p className="small subtle">{t("recording.limit")}</p>
        </div>
        </div>
        {discarding && <div className="recording-discard" role="alertdialog" aria-modal="true" aria-labelledby="discard-recording-title" aria-describedby="discard-recording-body">
          <h3 id="discard-recording-title" className="headline">{t("recording.discardTitle")}</h3>
          <p id="discard-recording-body">{t("recording.discardBody")}</p>
          <div className="row">
            <button type="button" className="btn tonal" autoFocus onClick={() => setDiscarding(false)}>{t("common.cancel")}</button>
            <button type="button" className="btn ghost" onClick={discard}>{t("recording.discard")}</button>
          </div>
        </div>}
      </section>
    </div>
  );
}
