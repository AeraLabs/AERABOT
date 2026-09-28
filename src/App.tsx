import { listen } from "@tauri-apps/api/event";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { probeLocalAI, resolveProvider, type ChatMessage, type LocalProviderStatus } from "./ai/local";
import { planWithLocalModel } from "./ai/planner";
import { playEarcon, unlockAudio } from "./audio/earcons";
import { playWavBytes, probeLocalSpeech, synthesizeSpeech, transcribeAudio, type SpeechStatus } from "./audio/localSpeech";
import { startPcmRecorder, type PcmRecorder } from "./audio/recorder";
import {
  loadPreferences,
  savePreferences,
  type AeraPreferences,
  type AiProviderPreference,
  type GraphicsQuality,
  type MotionPreference,
  type TalkBackPreference,
} from "./core/preferences";
import { parseDirectIntent } from "./core/directIntent";
import { AeraRuntime, type RuntimeEvent } from "./core/runtime";
import { OrbScene } from "./orb/OrbScene";
import { quantizedWindowKey } from "./orb/spatial";
import { visualFor, type OrbState } from "./orb/state";
import { getKnownAppStatus, type KnownAppStatus } from "./platform/apps";
import {
  beginNativeDrag,
  getForegroundWindowSnapshot,
  getSystemProfile,
  glideOrbHostPhysical,
  isTauriRuntime,
  listMonitors,
  resizeOrbHost,
  type ForegroundWindowSnapshot,
  type MonitorSnapshot,
  type SystemProfile,
} from "./platform/bridge";
import {
  isReaperForeground,
  planSpatialTarget,
} from "./platform/spatialAwareness";
import { getReaperOscStatus, type ReaperOscStatus } from "./platform/reaperOsc";
import { reaperSkill } from "./skills/reaper";

type TranscriptEntry = {
  role: "user" | "assistant";
  content: string;
  meta?: string;
};

const systemPrefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

function resolvedReducedMotion(preferences: AeraPreferences, systemValue: boolean) {
  if (preferences.motion === "reduce") return true;
  if (preferences.motion === "full") return false;
  return systemValue;
}

function shortModelName(model: string) {
  const normalized = model.replaceAll("\\", "/");
  const leaf = normalized.split("/").pop() || model;
  return leaf.length > 42 ? leaf.slice(0, 39) + "…" : leaf;
}

export function App() {
  const runtime = useMemo(() => {
    const instance = new AeraRuntime();
    instance.skills.register(reaperSkill);
    return instance;
  }, []);
  const recorderRef = useRef<PcmRecorder | null>(null);
  const lastSpatialKeyRef = useRef("");
  const lastSpatialMoveRef = useRef(0);
  const manualSpatialHoldUntilRef = useRef(0);

  const [state, setState] = useState<OrbState>(runtime.state);
  const [message, setMessage] = useState("AERA ambient");
  const [profile, setProfile] = useState<SystemProfile | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [command, setCommand] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [providers, setProviders] = useState<LocalProviderStatus[]>([]);
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus | null>(null);
  const [reaperStatus, setReaperStatus] = useState<KnownAppStatus | null>(null);
  const [reaperOscStatus, setReaperOscStatus] = useState<ReaperOscStatus | null>(null);
  const [foreground, setForeground] = useState<ForegroundWindowSnapshot | null>(null);
  const [monitors, setMonitors] = useState<MonitorSnapshot[]>([]);
  const [serviceBusy, setServiceBusy] = useState(false);
  const [systemReducedMotion, setSystemReducedMotion] = useState(systemPrefersReducedMotion);
  const [preferences, setPreferences] = useState<AeraPreferences>(loadPreferences);

  const reducedMotion = resolvedReducedMotion(preferences, systemReducedMotion);
  const activeProvider = useMemo(
    () => resolveProvider(preferences.aiProvider, providers),
    [preferences.aiProvider, providers],
  );
  const availableModels = activeProvider?.models ?? [];
  const activeModel =
    preferences.aiModel && availableModels.includes(preferences.aiModel)
      ? preferences.aiModel
      : availableModels[0] ?? "";

  const refreshLocalServices = async () => {
    setServiceBusy(true);
    const [aiResult, speechResult, reaperResult, oscResult] = await Promise.allSettled([
      probeLocalAI(),
      probeLocalSpeech(),
      getKnownAppStatus("reaper"),
      getReaperOscStatus(),
    ]);

    if (aiResult.status === "fulfilled") setProviders(aiResult.value);
    if (speechResult.status === "fulfilled") setSpeechStatus(speechResult.value);
    if (reaperResult.status === "fulfilled") setReaperStatus(reaperResult.value);
    if (oscResult.status === "fulfilled") setReaperOscStatus(oscResult.value);
    setServiceBusy(false);
  };

  useEffect(() => {
    getSystemProfile().then(setProfile).catch(() => undefined);
    listMonitors().then(setMonitors).catch(() => undefined);
    refreshLocalServices().catch(() => undefined);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => setSystemReducedMotion(mq.matches);
    mq.addEventListener?.("change", onMotion);

    const unsubscribe = runtime.subscribe((event: RuntimeEvent) => {
      if (event.type === "state") {
        setState(event.state);
        setMessage("AERA " + event.state.toLowerCase());
        playEarcon(event.state, !preferences.muted).catch(() => undefined);
      }
      if (event.type === "message") setMessage(event.message);
    });

    return () => {
      unsubscribe();
      mq.removeEventListener?.("change", onMotion);
    };
  }, [runtime, preferences.muted]);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let unlisten: (() => void) | undefined;
    listen("aera-summon", () => {
      setPanelOpen(true);
      runtime.setState("AWAKE");
      runtime.notify("Summoned");
    })
      .then((cleanup) => {
        unlisten = cleanup;
      })
      .catch(() => undefined);

    return () => unlisten?.();
  }, [runtime]);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let disposed = false;
    const poll = async () => {
      try {
        const snapshot = await getForegroundWindowSnapshot();
        if (!disposed && snapshot.available && !snapshot.isAera) {
          setForeground(snapshot);
        }
      } catch {
        // Awareness is best-effort and never blocks the orb.
      }
    };

    poll();
    const timer = window.setInterval(poll, 900);
    const monitorTimer = window.setInterval(() => {
      listMonitors().then((value) => {
        if (!disposed) setMonitors(value);
      }).catch(() => undefined);
    }, 5000);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.clearInterval(monitorTimer);
    };
  }, []);

  useEffect(() => {
    if (!foreground || panelOpen) return;
    const reaperFocused = isReaperForeground(foreground);

    if (
      reaperFocused &&
      (state === "AMBIENT" || state === "AWAKE" || state === "IDLE")
    ) {
      runtime.setState("STUDIO");
      runtime.notify("REAPER focus detected · Studio Mode");
      return;
    }

    if (!reaperFocused && state === "STUDIO") {
      runtime.setState("AMBIENT");
      runtime.notify(
        foreground.appName ? "Focused: " + foreground.appName : "AERA ambient",
      );
    }
  }, [foreground, panelOpen, runtime, state]);

  useEffect(() => {
    if (
      !preferences.spatialAwareness ||
      !foreground?.bounds ||
      foreground.minimized ||
      panelOpen ||
      monitors.length === 0
    ) {
      return;
    }

    const passiveStates: OrbState[] = [
      "IDLE",
      "AMBIENT",
      "STUDIO",
      "DND",
      "SLEEPING",
    ];
    if (!passiveStates.includes(state)) return;
    if (Date.now() < manualSpatialHoldUntilRef.current) return;

    const key = quantizedWindowKey(
      foreground.appId,
      null,
      foreground.bounds,
    );
    if (key === lastSpatialKeyRef.current) return;
    if (Date.now() - lastSpatialMoveRef.current < 1800) return;

    const orbSize = visualFor(state).nativeDiameter + 64;
    const target = planSpatialTarget(foreground, monitors, orbSize, 18);
    if (!target) return;

    lastSpatialKeyRef.current = key;
    lastSpatialMoveRef.current = Date.now();
    glideOrbHostPhysical(target.x, target.y, reducedMotion).catch(() => undefined);
  }, [
    foreground,
    monitors,
    panelOpen,
    preferences.spatialAwareness,
    reducedMotion,
    state,
  ]);

  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    if (!activeProvider || availableModels.length === 0) return;
    if (preferences.aiModel && availableModels.includes(preferences.aiModel)) return;
    setPreferences((current) => ({ ...current, aiModel: availableModels[0] }));
  }, [activeProvider, availableModels, preferences.aiModel]);

  useEffect(() => {
    const diameter = panelOpen ? 520 : visualFor(state).nativeDiameter + 64;
    resizeOrbHost(diameter).catch(() => undefined);
  }, [panelOpen, state]);

  const patchPreferences = (patch: Partial<AeraPreferences>) => {
    setPreferences((current) => ({ ...current, ...patch }));
  };

  const activate = async () => {
    await unlockAudio().catch(() => undefined);
    if (panelOpen) return;

    if (state === "SLEEPING" || state === "AMBIENT" || state === "DND") {
      runtime.setState("AWAKE");
    } else {
      runtime.setState("LISTENING");
    }
  };

  const appendAssistant = (content: string, meta?: string) => {
    const entry: TranscriptEntry = { role: "assistant", content, meta };
    setTranscript((current) => [...current, entry].slice(-30));
  };

  const finishReply = async (reply: string, finalState: OrbState) => {
    const wantsVoice =
      preferences.talkBack === "voice" ||
      (preferences.talkBack === "auto" && speechStatus?.piperAvailable);

    if (wantsVoice && speechStatus?.piperAvailable) {
      runtime.setState("SPEAKING");
      runtime.notify(reply);
      try {
        const audio = await synthesizeSpeech(reply);
        await playWavBytes(audio);
      } catch {
        // The text response remains authoritative when local TTS cannot play.
      }
    }

    runtime.setState(finalState);
    runtime.notify(reply);
  };


  const processInput = async (value: string) => {
    const clean = value.trim();
    if (!clean) return;

    await unlockAudio().catch(() => undefined);
    const userEntry: TranscriptEntry = { role: "user", content: clean };
    setTranscript((current) => [...current, userEntry].slice(-30));
    runtime.notify("“" + clean + "”");

    if (await runtime.runInternalCommand(clean)) return;

    const directIntent = parseDirectIntent(clean);
    if (directIntent) {
      const proposal = await runtime.skills.propose(
        directIntent.capability,
        directIntent.input,
      );
      const action = proposal?.action ?? null;

      if (!action) {
        const reply = "That command is not available through an installed AERA Skill.";
        runtime.setState("QUESTION");
        runtime.notify(reply);
        appendAssistant(reply, "AERA direct intent");
        return;
      }

      const result = await runtime.execute(action);
      const reply = result.ok
        ? directIntent.successMessage
        : "I couldn't complete that command: " +
          ("error" in result && result.error
            ? result.error
            : "the action was not permitted.");

      appendAssistant(reply, "AERA direct intent · local");
      await finishReply(
        reply,
        result.ok && directIntent.input.appId === "reaper" ? "STUDIO" : result.ok ? "SUCCESS" : "ERROR",
      );
      return;
    }

    const provider = resolveProvider(preferences.aiProvider, providers);
    const model =
      provider &&
      (preferences.aiModel && provider.models.includes(preferences.aiModel)
        ? preferences.aiModel
        : provider.models[0]);

    if (!provider || !model) {
      runtime.setState("QUESTION");
      const reply =
        "No local language model is available yet. Start Ollama or a llama.cpp server, then press Refresh. AERA will use the models already installed there.";
      appendAssistant(reply);
      runtime.notify(reply);
      return;
    }

    runtime.setState("THINKING");

    const history: ChatMessage[] = transcript.slice(-10).map((entry) => ({
      role: entry.role,
      content: entry.content,
    }));

    try {
      const { plan, response } = await planWithLocalModel(
        {
          provider: provider.id,
          model,
          messages: [
            ...history,
            { role: "user", content: clean },
          ],
        },
        runtime.skills.plannerCatalog(),
      );

      const meta =
        response.elapsedMs > 0
          ? provider.name + " · " + shortModelName(response.model) + " · " + response.elapsedMs + " ms"
          : provider.name + " · " + shortModelName(response.model);

      let reply = plan.message;

      if (plan.kind === "action") {
        const proposal = await runtime.skills.propose(plan.capability, plan.input);
        const action = proposal?.action ?? null;

        if (!action) {
          reply = "That action is not available through an installed AERA Skill.";
          runtime.setState("QUESTION");
        } else {
          const result = await runtime.execute(action);
          if (result.ok) {
            reply = plan.message;
            if (plan.capability === "software.open") {
              setReaperStatus((current) =>
                current ? { ...current, installed: true } : current,
              );
            }
          } else {
            reply =
              "I couldn't complete that REAPER action: " +
              ("error" in result && result.error
                ? result.error
                : "the action was not permitted.");
          }
        }
      }

      appendAssistant(reply, meta);
      const finalState: OrbState =
        runtime.state === "ERROR"
          ? "ERROR"
          : runtime.state === "QUESTION"
            ? "QUESTION"
            : plan.kind === "action" && plan.input.appId === "reaper"
              ? "STUDIO"
              : "SUCCESS";
      await finishReply(reply, finalState);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const reply = "Local AI error: " + detail;
      runtime.setState("ERROR");
      runtime.notify(reply);
      appendAssistant(reply);
      refreshLocalServices().catch(() => undefined);
    }
  };

  const submitCommand = async (event: FormEvent) => {
    event.preventDefault();
    const value = command;
    setCommand("");
    await processInput(value);
  };

  const toggleVoice = async () => {
    if (recording && recorderRef.current) {
      const recorder = recorderRef.current;
      recorderRef.current = null;
      setRecording(false);
      runtime.setState("UNDERSTANDING");
      runtime.notify("Transcribing locally…");

      try {
        const wav = await recorder.stop();
        const text = await transcribeAudio(wav);
        await processInput(text);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        runtime.setState("ERROR");
        runtime.notify(detail);
      }
      return;
    }

    if (!speechStatus?.whisperAvailable) {
      runtime.setState("QUESTION");
      runtime.notify("whisper.cpp is not running on the local speech port.");
      return;
    }

    try {
      recorderRef.current = await startPcmRecorder();
      setRecording(true);
      runtime.setState("LISTENING");
      runtime.notify("Listening locally…");
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      runtime.setState("ERROR");
      runtime.notify(detail);
    }
  };

  return (
    <main
      className={"aera-root" + (panelOpen ? " panel-open" : "")}
      data-state={state.toLowerCase()}
    >
      <button
        className="orb-hit-area"
        aria-label={message}
        onClick={activate}
        onPointerDown={(event) => {
          if (event.button === 0 && event.altKey) {
            manualSpatialHoldUntilRef.current = Date.now() + 30_000;
            lastSpatialKeyRef.current = "";
            beginNativeDrag().catch(() => undefined);
          }
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          setPanelOpen((value) => !value);
        }}
      >
        <OrbScene
          state={state}
          reducedMotion={reducedMotion}
          quality={preferences.quality}
        />
        <span className="orb-aura" />
      </button>

      {panelOpen && (
        <section className="control-panel" aria-label="AERA controls">
          <header className="panel-header">
            <div className="aera-wordmark">
              <strong>AERA</strong>
              <span>{state.toLowerCase()}</span>
            </div>

            <div className="service-cluster" aria-label="Local services">
              <span className={activeProvider ? "service-on" : "service-off"}>
                AI
              </span>
              <span className={speechStatus?.whisperAvailable ? "service-on" : "service-off"}>
                MIC
              </span>
              <span className={speechStatus?.piperAvailable ? "service-on" : "service-off"}>
                VOICE
              </span>
              <span
                className={reaperStatus?.installed ? "service-on" : "service-off"}
                title={reaperStatus?.installed ? "REAPER Skill ready" : "REAPER not detected"}
              >
                REAPER
              </span>
              <span
                className={reaperOscStatus?.enabled ? "service-on" : "service-off"}
                title={
                  reaperOscStatus?.enabled
                    ? "REAPER OSC armed on loopback port " + reaperOscStatus.port
                    : "REAPER OSC disabled"
                }
              >
                OSC
              </span>
              <span
                className={foreground?.available ? "service-on" : "service-off"}
                title={
                  foreground?.appName
                    ? "Foreground: " +
                      foreground.appName +
                      (foreground.title ? " · " + foreground.title : "")
                    : "Foreground app unavailable"
                }
              >
                FOCUS
              </span>
              <button
                type="button"
                className="refresh-button"
                disabled={serviceBusy}
                onClick={() => refreshLocalServices()}
              >
                {serviceBusy ? "…" : "↻"}
              </button>
              <button
                type="button"
                className="panel-close"
                aria-label="Close AERA controls"
                onClick={() => setPanelOpen(false)}
              >
                ×
              </button>
            </div>
          </header>

          <div className="conversation" aria-live="polite">
            {transcript.length === 0 ? (
              <div className="conversation-empty">
                <strong>Local intelligence ready.</strong>
                <span>
                  Ask a question, use the microphone, or tell AERA to enter Studio mode.
                </span>
              </div>
            ) : (
              transcript.map((entry, index) => (
                <article className={"message " + entry.role} key={index}>
                  <span>{entry.role === "user" ? "YOU" : "AERA"}</span>
                  <p>{entry.content}</p>
                  {entry.meta && <small>{entry.meta}</small>}
                </article>
              ))
            )}
          </div>

          <form className="command-form" onSubmit={submitCommand}>
            <button
              className={"mic-button" + (recording ? " recording" : "")}
              type="button"
              aria-label={recording ? "Stop listening" : "Speak to AERA"}
              aria-pressed={recording}
              onClick={toggleVoice}
            >
              {recording ? "■" : "◉"}
            </button>
            <input
              autoFocus
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              placeholder="Ask AERA or enter a command…"
              aria-label="AERA command"
            />
            <button className="run-button" type="submit">
              Run
            </button>
          </form>

          <div className="ai-row">
            <label>
              <span>Local runtime</span>
              <select
                value={preferences.aiProvider}
                onChange={(event) =>
                  patchPreferences({
                    aiProvider: event.target.value as AiProviderPreference,
                    aiModel: "",
                  })
                }
              >
                <option value="auto">Auto detect</option>
                <option value="ollama">Ollama</option>
                <option value="llamacpp">llama.cpp</option>
                <option value="openai_local">OpenAI-compatible local</option>
              </select>
            </label>

            <label className="model-field">
              <span>Model</span>
              <select
                value={activeModel}
                disabled={!activeProvider || availableModels.length === 0}
                onChange={(event) => patchPreferences({ aiModel: event.target.value })}
              >
                {availableModels.length === 0 ? (
                  <option value="">No model detected</option>
                ) : (
                  availableModels.map((model) => (
                    <option value={model} key={model}>
                      {shortModelName(model)}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>

          <div className="state-row" aria-label="AERA modes">
            {(["AMBIENT", "LISTENING", "THINKING", "STUDIO", "DND", "SLEEPING"] as OrbState[]).map(
              (mode) => (
                <button
                  type="button"
                  key={mode}
                  className={state === mode ? "active" : ""}
                  onClick={() => runtime.setState(mode)}
                >
                  {mode === "SLEEPING" ? "Sleep" : mode[0] + mode.slice(1).toLowerCase()}
                </button>
              ),
            )}
          </div>

          <div className="preference-grid">
            <label>
              <span>Graphics</span>
              <select
                value={preferences.quality}
                onChange={(event) =>
                  patchPreferences({ quality: event.target.value as GraphicsQuality })
                }
              >
                <option value="auto">Auto</option>
                <option value="ultra">Ultra</option>
                <option value="high">High</option>
                <option value="balanced">Balanced</option>
                <option value="efficiency">Efficiency</option>
              </select>
            </label>

            <label>
              <span>Motion</span>
              <select
                value={preferences.motion}
                onChange={(event) =>
                  patchPreferences({ motion: event.target.value as MotionPreference })
                }
              >
                <option value="system">System</option>
                <option value="reduce">Reduced</option>
                <option value="full">Full</option>
              </select>
            </label>

            <label>
              <span>Talk back</span>
              <select
                value={preferences.talkBack}
                onChange={(event) =>
                  patchPreferences({ talkBack: event.target.value as TalkBackPreference })
                }
              >
                <option value="auto">Auto</option>
                <option value="text">Text only</option>
                <option value="voice">Local voice</option>
              </select>
            </label>

            <label className="toggle-row">
              <span>Earcons</span>
              <input
                type="checkbox"
                checked={!preferences.muted}
                onChange={(event) => patchPreferences({ muted: !event.target.checked })}
              />
            </label>

            <label className="toggle-row">
              <span>Spatial</span>
              <input
                type="checkbox"
                checked={preferences.spatialAwareness}
                onChange={(event) =>
                  patchPreferences({ spatialAwareness: event.target.checked })
                }
              />
            </label>
          </div>

          <footer className="panel-footer">
            <span>{message}</span>
            {profile && (
              <small>
                {profile.platform} · {profile.architecture} · {profile.aiRuntime}
              </small>
            )}
            {foreground && (
              <small>
                Focus · {foreground.appName ?? "unknown app"}
                {foreground.title ? " · " + foreground.title : ""}
                {foreground.permissionRequired && !foreground.permissionGranted
                  ? " · geometry permission needed"
                  : ""}
              </small>
            )}
          </footer>
        </section>
      )}

      {!panelOpen && (
        <>
          <section className="status-card" aria-live="polite">
            <strong>{state}</strong>
            <span>{message}</span>
            {profile && <small>{profile.platform} · {profile.architecture}</small>}
          </section>
          <div className="dev-hint" aria-hidden="true">
            click: summon · alt-drag: move · right-click: controls
          </div>
        </>
      )}
    </main>
  );
}
