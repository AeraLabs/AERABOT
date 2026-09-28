import { listen } from "@tauri-apps/api/event";
import { SkillManager } from "./components/SkillManager";
import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { probeLocalAI, resolveProvider, type ChatMessage, type LocalProviderStatus } from "./ai/local";
import { planWithLocalModel } from "./ai/planner";
import { playEarcon, unlockAudio } from "./audio/earcons";
import { playWavBytes, probeLocalSpeech, synthesizeSpeech, transcribeAudio, type SpeechStatus } from "./audio/localSpeech";
import { startPcmRecorder, type PcmRecorder } from "./audio/recorder";
import {
  DEFAULT_ORB_PALETTE,
  loadPreferences,
  savePreferences,
  type AeraPreferences,
  type AiProviderPreference,
  type GraphicsQuality,
  type MotionPreference,
  type OrbSizePreference,
  type PresenceStyle,
  type SpatialBehavior,
  type TalkBackPreference,
} from "./core/preferences";
import { ORB_SIZE_MULTIPLIERS, SPATIAL_BEHAVIOR } from "./core/appearance";
import {
  applyAppearanceProfile,
  captureAppearanceProfile,
  loadAppearanceProfiles,
  saveAppearanceProfiles,
  type AppearanceProfile,
} from "./core/appearanceProfiles";
import { answerLocalContextQuery } from "./core/contextQueries";
import { parseDirectIntent } from "./core/directIntent";
import { parsePreferenceIntent } from "./core/preferenceIntent";
import { answerVerifiedReaperQuery } from "./core/reaperQueries";
import { AeraRuntime, type RuntimeEvent } from "./core/runtime";
import { isUndoIntent } from "./core/undoIntent";
import { OrbScene } from "./orb/OrbScene";
import { paletteCssVariables } from "./orb/palette";
import { quantizedWindowKey } from "./orb/spatial";
import { visualFor, type OrbState } from "./orb/state";
import { getKnownAppStatus, type KnownAppStatus } from "./platform/apps";
import {
  foregroundDaw,
  foregroundDawModelContext,
  isCoreDawId,
} from "./platform/dawAwareness";
import {
  beginNativeDrag,
  getForegroundWindowSnapshot,
  getSystemProfile,
  glideOrbHostPhysical,
  isTauriRuntime,
  listMonitors,
  requestForegroundPermission,
  resizeOrbHost,
  type ForegroundWindowSnapshot,
  type MonitorSnapshot,
  type SystemProfile,
} from "./platform/bridge";
import {
  isReaperForeground,
  planSpatialTarget,
} from "./platform/spatialAwareness";
import {
  dawModelContext,
  flStudioModelContext,
  getDawBridgeStatus,
  getFlStudioBridgeStatus,
  installFlStudioBridge,
  installLogicBridge,
  installProToolsBridge,
  prepareDawBridge,
  type DawBridgeStatus,
  wavrModelContext,
} from "./platform/dawBridge";
import { getReaperOscStatus, type ReaperOscStatus } from "./platform/reaperOsc";
import {
  getReaperState,
  installReaperBridge,
  reaperModelContext,
  reaperTransportLabel,
  type ReaperBridgeStatus,
} from "./platform/reaperState";
import { abletonSkill } from "./skills/ableton";
import { logicSkill } from "./skills/logic";
import { proToolsSkill } from "./skills/protools";
import { flStudioSkill } from "./skills/flstudio";
import { reaperSkill } from "./skills/reaper";
import { wavrSkill } from "./skills/wavr";
import {
  analyzeVisualContext,
  captureVisualContext,
  setVisualContextEnabled,
} from "./platform/visualContext";
import {
  consumeWakeWordEvent,
  getWakeWordStatus,
  installWakeWordCompanion,
  type WakeWordEvent,
  type WakeWordStatus,
} from "./platform/wakeword";

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
    instance.skills.register(flStudioSkill);
    instance.skills.register(proToolsSkill);
    instance.skills.register(logicSkill);
    instance.skills.register(abletonSkill);
    instance.skills.register(wavrSkill);
    return instance;
  }, []);
  const recorderRef = useRef<PcmRecorder | null>(null);
  const lastSpatialKeyRef = useRef("");
  const lastSpatialMoveRef = useRef(0);
  const manualSpatialHoldUntilRef = useRef(0);
  const wakeCaptureBusyRef = useRef(false);

  const [state, setState] = useState<OrbState>(runtime.state);
  const [message, setMessage] = useState("AERA ambient");
  const [profile, setProfile] = useState<SystemProfile | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [skillManagerOpen, setSkillManagerOpen] = useState(
    () => !loadPreferences().onboardingComplete,
  );
  const [command, setCommand] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [providers, setProviders] = useState<LocalProviderStatus[]>([]);
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus | null>(null);
  const [reaperStatus, setReaperStatus] = useState<KnownAppStatus | null>(null);
  const [dawStatuses, setDawStatuses] = useState<KnownAppStatus[]>([]);
  const [reaperOscStatus, setReaperOscStatus] = useState<ReaperOscStatus | null>(null);
  const [reaperBridge, setReaperBridge] = useState<ReaperBridgeStatus | null>(null);
  const [flStudioBridge, setFlStudioBridge] = useState<DawBridgeStatus | null>(null);
  const [abletonBridge, setAbletonBridge] = useState<DawBridgeStatus | null>(null);
  const [logicBridge, setLogicBridge] = useState<DawBridgeStatus | null>(null);
  const [proToolsBridge, setProToolsBridge] = useState<DawBridgeStatus | null>(null);
  const [wavrBridge, setWavrBridge] = useState<DawBridgeStatus | null>(null);
  const [wakeWordStatus, setWakeWordStatus] = useState<WakeWordStatus | null>(null);
  const [pendingWakeEvent, setPendingWakeEvent] = useState<WakeWordEvent | null>(null);
  const [foreground, setForeground] = useState<ForegroundWindowSnapshot | null>(null);
  const [monitors, setMonitors] = useState<MonitorSnapshot[]>([]);
  const [serviceBusy, setServiceBusy] = useState(false);
  const [systemReducedMotion, setSystemReducedMotion] = useState(systemPrefersReducedMotion);
  const [preferences, setPreferences] = useState<AeraPreferences>(loadPreferences);
  const [appearanceProfiles, setAppearanceProfiles] = useState<AppearanceProfile[]>(
    loadAppearanceProfiles,
  );
  const [appearanceProfileName, setAppearanceProfileName] = useState("");

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
    const [aiResult, speechResult, dawsResult, oscResult] = await Promise.allSettled([
      probeLocalAI(),
      probeLocalSpeech(),
      Promise.all(
        ["reaper", "flstudio", "protools", "logic", "ableton"].map((appId) =>
          getKnownAppStatus(appId),
        ),
      ),
      getReaperOscStatus(),
    ]);

    if (aiResult.status === "fulfilled") setProviders(aiResult.value);
    if (speechResult.status === "fulfilled") setSpeechStatus(speechResult.value);
    if (dawsResult.status === "fulfilled") {
      setDawStatuses(dawsResult.value);
      setReaperStatus(
        dawsResult.value.find((status) => status.id === "reaper") ?? null,
      );
    }
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
    if (!isTauriRuntime()) return;

    let disposed = false;
    const pollReaper = async () => {
      try {
        const status = await getReaperState();
        if (!disposed) setReaperBridge(status);
      } catch {
        // A missing companion script is a normal disconnected state.
      }
    };

    pollReaper();
    const timer = window.setInterval(pollReaper, 600);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let disposed = false;
    const pollFlStudio = async () => {
      try {
        const status = await getFlStudioBridgeStatus();
        if (!disposed) setFlStudioBridge(status);
      } catch {
        // FL Studio bridge is optional.
      }
    };

    pollFlStudio();
    const timer = window.setInterval(pollFlStudio, 650);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let disposed = false;
    const pollAbleton = async () => {
      try {
        const status = await getDawBridgeStatus("ableton");
        if (!disposed) setAbletonBridge(status);
      } catch {
        // Ableton bridge is optional.
      }
    };

    pollAbleton();
    const timer = window.setInterval(pollAbleton, 650);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!isTauriRuntime()) return;

    let disposed = false;
    const pollCompanions = async () => {
      const [logicResult, proToolsResult, wavrResult] = await Promise.allSettled([
        getDawBridgeStatus("logic"),
        getDawBridgeStatus("protools"),
        getDawBridgeStatus("wavr"),
      ]);
      if (disposed) return;
      if (logicResult.status === "fulfilled") {
        setLogicBridge(logicResult.value);
      }
      if (proToolsResult.status === "fulfilled") {
        setProToolsBridge(proToolsResult.value);
      }
      if (wavrResult.status === "fulfilled") {
        setWavrBridge(wavrResult.value);
      }
    };

    pollCompanions();
    const timer = window.setInterval(pollCompanions, 500);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let disposed = false;
    const pollWakeWord = async () => {
      try {
        const status = await getWakeWordStatus();
        if (!disposed) setWakeWordStatus(status);

        if (!preferences.wakeWordEnabled || !status.available) return;
        const event = await consumeWakeWordEvent();
        if (!disposed && event) {
          runtime.setState("AWAKE");
          runtime.notify("Wake phrase detected · " + event.phrase);
          setPendingWakeEvent(event);
        }
      } catch {
        // Wake word is an optional local companion.
      }
    };

    pollWakeWord();
    const timer = window.setInterval(pollWakeWord, 350);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [preferences.wakeWordEnabled, runtime]);

  useEffect(() => {
    if (!foreground || panelOpen) return;
    const daw = foregroundDaw(foreground);

    if (
      daw &&
      (state === "AMBIENT" || state === "AWAKE" || state === "IDLE")
    ) {
      runtime.setState("STUDIO");
      runtime.notify(daw.name + " focus detected · Studio Mode");
      return;
    }

    if (!daw && state === "STUDIO") {
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

    const behavior = SPATIAL_BEHAVIOR[preferences.spatialBehavior];
    if (!behavior.activeStates.has(state)) return;
    if (Date.now() < manualSpatialHoldUntilRef.current) return;

    const key = behavior.reactsToGeometry
      ? quantizedWindowKey(foreground.appId, null, foreground.bounds)
      : foreground.appId ?? foreground.appName ?? "unknown";
    if (key === lastSpatialKeyRef.current) return;
    if (Date.now() - lastSpatialMoveRef.current < behavior.cooldownMs) return;

    const orbSize =
      (visualFor(state).nativeDiameter + 64) *
      ORB_SIZE_MULTIPLIERS[preferences.orbSize];
    const target = planSpatialTarget(foreground, monitors, orbSize, 18);
    if (!target) return;

    lastSpatialKeyRef.current = key;
    lastSpatialMoveRef.current = Date.now();
    glideOrbHostPhysical(target.x, target.y, reducedMotion).catch(() => undefined);
  }, [
    foreground,
    monitors,
    panelOpen,
    preferences.orbSize,
    preferences.spatialAwareness,
    preferences.spatialBehavior,
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
    const diameter = skillManagerOpen
      ? 720
      : panelOpen
        ? 552
        : (visualFor(state).nativeDiameter + 64) *
          ORB_SIZE_MULTIPLIERS[preferences.orbSize];
    resizeOrbHost(diameter).catch(() => undefined);
  }, [panelOpen, preferences.orbSize, skillManagerOpen, state]);

  const patchPreferences = (patch: Partial<AeraPreferences>) => {
    setPreferences((current) => ({ ...current, ...patch }));
  };

  const setVisualContextPreference = async (enabled: boolean) => {
    try {
      const status = await setVisualContextEnabled(enabled);
      patchPreferences({ visualContextEnabled: status.enabled });
      const reply = status.enabled
        ? "Visual Context enabled for this session. I will only capture a window after an explicit look request."
        : "Visual Context disabled.";
      runtime.notify(reply);
      appendAssistant(reply, "AERA privacy · local");
    } catch (error) {
      const reply = error instanceof Error ? error.message : String(error);
      runtime.setState("ERROR");
      runtime.notify(reply);
      appendAssistant(reply, "AERA visual context");
    }
  };

  const patchOrbColor = (
    key: "primary" | "secondary" | "accent",
    value: string,
  ) => {
    setPreferences((current) => ({
      ...current,
      orbPalette: {
        ...current.orbPalette,
        [key]: value,
      },
    }));
  };

  const resetOrbAppearance = () => {
    setPreferences((current) => ({
      ...current,
      orbPalette: DEFAULT_ORB_PALETTE,
      presenceStyle: "balanced",
      orbSize: "standard",
      spatialBehavior: "adaptive",
    }));
  };

  const saveCurrentAppearance = () => {
    const id =
      "look-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 7);
    const profile = captureAppearanceProfile(
      id,
      appearanceProfileName || "AERA Look " + (appearanceProfiles.length + 1),
      preferences,
    );
    const next = saveAppearanceProfiles([
      profile,
      ...appearanceProfiles.filter((candidate) => candidate.id !== profile.id),
    ]);
    setAppearanceProfiles(next);
    setAppearanceProfileName("");
  };

  const useAppearanceProfile = (profile: AppearanceProfile) => {
    setPreferences((current) => applyAppearanceProfile(current, profile));
  };

  const removeAppearanceProfile = (id: string) => {
    const next = saveAppearanceProfiles(
      appearanceProfiles.filter((profile) => profile.id !== id),
    );
    setAppearanceProfiles(next);
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

  const enableWindowAwareness = async () => {
    try {
      const granted = await requestForegroundPermission();
      const reply = granted
        ? "Window geometry access is enabled."
        : "macOS opened Accessibility settings. Enable AERA there, then return to AERA.";
      runtime.notify(reply);
      appendAssistant(reply, "AERA setup · local");
    } catch (error) {
      const reply =
        error instanceof Error ? error.message : "Could not request window awareness.";
      runtime.notify(reply);
      appendAssistant(reply, "AERA setup");
    }
  };

  const installWakeWordLocalCompanion = async () => {
    try {
      const result = await installWakeWordCompanion();
      const reply = result.alreadyCurrent
        ? "The local wake-word companion script is already installed. Add your licensed sherpa-onnx model paths and start it locally."
        : "Wake-word companion installed locally. Add your licensed sherpa-onnx model paths and start it locally.";
      runtime.notify(reply);
      appendAssistant(reply, "AERA wake word · local");
    } catch (error) {
      const reply = error instanceof Error ? error.message : String(error);
      runtime.notify(reply);
      appendAssistant(reply, "AERA wake word");
    }
  };

  const installFlStudioCompanion = async () => {
    try {
      const result = await installFlStudioBridge();
      const reply = result.alreadyCurrent
        ? "The FL Studio AERA bridge is already installed. In FL Studio MIDI Settings, choose AERA Local Bridge as a Controller type."
        : "FL Studio bridge installed. In FL Studio MIDI Settings, choose AERA Local Bridge as a Controller type.";
      runtime.notify(reply);
      appendAssistant(reply, "AERA setup · local");
    } catch (error) {
      const reply = error instanceof Error ? error.message : String(error);
      runtime.notify(reply);
      appendAssistant(reply, "AERA setup");
    }
  };

  const installLogicCompanion = async () => {
    try {
      const result = await installLogicBridge();
      const reply = result.alreadyCurrent
        ? "The Logic AERA OSC companion is already installed. Configure Logic Controller Assignments and run the local companion."
        : "Logic AERA OSC companion installed. Configure Logic Controller Assignments and run the local companion.";
      runtime.notify(reply);
      appendAssistant(reply, "AERA Logic setup · local");
    } catch (error) {
      const reply = error instanceof Error ? error.message : String(error);
      runtime.notify(reply);
      appendAssistant(reply, "AERA Logic setup");
    }
  };

  const installProToolsCompanion = async () => {
    try {
      const result = await installProToolsBridge();
      const reply = result.alreadyCurrent
        ? "The Pro Tools AERA SDK wrapper is already installed. Run it with a helper built against Avid's Scripting SDK."
        : "Pro Tools AERA SDK wrapper installed. Run it with a helper built against Avid's Scripting SDK.";
      runtime.notify(reply);
      appendAssistant(reply, "AERA Pro Tools setup · local");
    } catch (error) {
      const reply = error instanceof Error ? error.message : String(error);
      runtime.notify(reply);
      appendAssistant(reply, "AERA Pro Tools setup");
    }
  };

  const prepareAbletonCompanion = async () => {
    try {
      await prepareDawBridge("ableton");
      const reply =
        "Ableton bridge folders are ready. Add the bundled aera_live_bridge.js to a Max for Live device and connect live.thisdevice to the js object.";
      runtime.notify(reply);
      appendAssistant(reply, "AERA setup · local");
    } catch (error) {
      const reply = error instanceof Error ? error.message : String(error);
      runtime.notify(reply);
      appendAssistant(reply, "AERA setup");
    }
  };

  const installReaperCompanion = async () => {
    try {
      const result = await installReaperBridge();
      const reply = result.alreadyCurrent
        ? "The REAPER bridge file is already current. Open REAPER’s Actions window and run aera_bridge.lua."
        : "REAPER bridge file installed. Open REAPER’s Actions window, load aera_bridge.lua, and run it.";
      runtime.notify(reply);
      appendAssistant(reply, "AERA setup · local");
    } catch (error) {
      const reply = error instanceof Error ? error.message : String(error);
      runtime.notify(reply);
      appendAssistant(reply, "AERA setup");
    }
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

  const verifiedActionReply = (
    capability: string,
    executionResult: unknown,
    confirmedMessage: string,
  ) => {
    if (!capability.startsWith("transport.")) return confirmedMessage;

    const evidence = (executionResult ?? {}) as {
      bridgeConnected?: boolean;
      verified?: boolean;
      observedTransport?: string | null;
    };

    if (evidence.verified) return confirmedMessage;

    const requested = capability.split(".")[1] ?? "transport command";
    if (evidence.bridgeConnected) {
      return (
        "I sent " +
        requested +
        " to REAPER, but the live bridge did not confirm the requested state" +
        (evidence.observedTransport
          ? " · it currently reports " + evidence.observedTransport
          : "") +
        "."
      );
    }

    return (
      "I sent " +
      requested +
      " to REAPER. The live bridge is not running, so I can’t independently confirm the transport state yet."
    );
  };



  const processInput = async (value: string) => {
    const clean = value.trim();
    if (!clean) return;

    await unlockAudio().catch(() => undefined);
    const userEntry: TranscriptEntry = { role: "user", content: clean };
    setTranscript((current) => [...current, userEntry].slice(-30));
    runtime.notify("“" + clean + "”");

    if (await runtime.runInternalCommand(clean)) return;

    const visualRequest = clean.match(
      /^(?:aera[ ,]+)?(?:look at this|look at|what(?:'s| is) on|what do you see(?: in)?|inspect)\s*(.*)$/i,
    );
    if (visualRequest) {
      if (!preferences.visualContextEnabled) {
        const reply =
          "Visual Context is off. Enable it in SETUP for this session before asking me to look.";
        runtime.setState("QUESTION");
        appendAssistant(reply, "AERA privacy · local");
        runtime.notify(reply);
        return;
      }

      const ollama = providers.find(
        (provider) => provider.id === "ollama" && provider.available,
      );
      const visualModel =
        preferences.visualModel &&
        ollama?.models.includes(preferences.visualModel)
          ? preferences.visualModel
          : "";

      if (!visualModel) {
        const reply =
          "Visual capture is enabled, but no local Ollama vision model is selected in SETUP.";
        runtime.setState("QUESTION");
        appendAssistant(reply, "AERA visual context · local");
        runtime.notify(reply);
        return;
      }

      if (!foreground?.processId) {
        const reply =
          "I do not have a verified external foreground window to inspect. Focus the window you want, then summon AERA again.";
        runtime.setState("QUESTION");
        appendAssistant(reply, "AERA visual context · local");
        runtime.notify(reply);
        return;
      }

      runtime.setState("UNDERSTANDING");
      runtime.notify("Capturing the last verified foreground window locally…");

      try {
        const capture = await captureVisualContext(
          foreground.processId,
          foreground.title,
        );
        const question =
          visualRequest[1]?.trim() ||
          "Describe the visible interface and anything relevant to what the user is doing. Be precise about uncertainty.";

        const vision = await analyzeVisualContext(
          visualModel,
          [
            "You are AERA's local visual-context reader.",
            "Analyze only what this one-time window capture visibly supports.",
            "Do not infer hidden state or claim an action happened unless it is visibly confirmed.",
            "Application: " + capture.appName,
            capture.title ? "Window title: " + capture.title : "",
            "User request: " + question,
          ]
            .filter(Boolean)
            .join("\n"),
          capture.png,
        );

        appendAssistant(
          vision.content,
          "AERA vision · local · " + capture.appName + " · " + vision.model,
        );
        await finishReply(vision.content, "SUCCESS");
      } catch (error) {
        const reply = error instanceof Error ? error.message : String(error);
        runtime.setState("ERROR");
        appendAssistant(reply, "AERA visual context · local");
        runtime.notify(reply);
      }
      return;
    }



    if (isUndoIntent(clean)) {
      const result = await runtime.undoLast();
      const reply = result.ok
        ? "Undone: " + result.action.description + "."
        : result.error;
      appendAssistant(reply, "AERA journal · verified local action");
      await finishReply(reply, result.ok ? "SUCCESS" : "QUESTION");
      return;
    }

    const preferenceIntent = parsePreferenceIntent(clean);
    if (preferenceIntent) {
      if (preferenceIntent.type === "presence") {
        patchPreferences({ presenceStyle: preferenceIntent.value });
      } else if (preferenceIntent.type === "size") {
        patchPreferences({ orbSize: preferenceIntent.value });
      } else if (preferenceIntent.type === "spatial") {
        patchPreferences({ spatialAwareness: preferenceIntent.value });
      } else {
        patchPreferences({
          spatialAwareness: true,
          spatialBehavior: preferenceIntent.value,
        });
      }

      appendAssistant(preferenceIntent.message, "AERA preference · local");
      await finishReply(preferenceIntent.message, "SUCCESS");
      return;
    }

    const contextAnswer = answerLocalContextQuery(clean, {
      foreground,
      dawStatuses,
      spatialAwareness: preferences.spatialAwareness,
      spatialBehavior: preferences.spatialBehavior,
    });
    if (contextAnswer) {
      appendAssistant(contextAnswer.message, contextAnswer.meta);
      await finishReply(contextAnswer.message, "SUCCESS");
      return;
    }

    const verifiedReaperReply = answerVerifiedReaperQuery(
      clean,
      reaperBridge?.available && !reaperBridge.stale
        ? reaperBridge.state
        : null,
      Boolean(foreground && isReaperForeground(foreground)),
    );
    if (verifiedReaperReply) {
      appendAssistant(verifiedReaperReply, "REAPER live · verified local state");
      await finishReply(verifiedReaperReply, "STUDIO");
      return;
    }

    const directIntent = parseDirectIntent(clean, foregroundDaw(foreground)?.id);
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
        ? verifiedActionReply(
            directIntent.capability,
            result.result,
            directIntent.successMessage,
          )
        : "I couldn't complete that command: " +
          ("error" in result && result.error
            ? result.error
            : "the action was not permitted.");

      appendAssistant(reply, "AERA direct intent · local");
      await finishReply(
        reply,
        result.ok && isCoreDawId(directIntent.input.appId)
          ? "STUDIO"
          : result.ok
            ? "SUCCESS"
            : "ERROR",
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
            ...(foregroundDawModelContext(foreground)
              ? [
                  {
                    role: "system" as const,
                    content: foregroundDawModelContext(foreground)!,
                  },
                ]
              : []),
            ...(foreground &&
            isReaperForeground(foreground) &&
            reaperBridge?.available &&
            !reaperBridge.stale &&
            reaperBridge.state
              ? [
                  {
                    role: "system" as const,
                    content: reaperModelContext(reaperBridge.state),
                  },
                ]
              : []),
            ...(foregroundDaw(foreground)?.id === "flstudio" &&
            flStudioBridge?.available &&
            !flStudioBridge.stale &&
            flStudioBridge.state
              ? [
                  {
                    role: "system" as const,
                    content: flStudioModelContext(flStudioBridge.state),
                  },
                ]
              : []),
            ...(foregroundDaw(foreground)?.id === "ableton" &&
            abletonBridge?.available &&
            !abletonBridge.stale &&
            abletonBridge.state
              ? [
                  {
                    role: "system" as const,
                    content: dawModelContext("Ableton Live", abletonBridge.state),
                  },
                ]
              : []),
            ...(foregroundDaw(foreground)?.id === "logic" &&
            logicBridge?.available &&
            !logicBridge.stale &&
            logicBridge.state
              ? [
                  {
                    role: "system" as const,
                    content: dawModelContext("Logic Pro", logicBridge.state),
                  },
                ]
              : []),
            ...(foregroundDaw(foreground)?.id === "protools" &&
            proToolsBridge?.available &&
            !proToolsBridge.stale &&
            proToolsBridge.state
              ? [
                  {
                    role: "system" as const,
                    content: dawModelContext("Pro Tools", proToolsBridge.state),
                  },
                ]
              : []),
            ...(wavrBridge?.available && !wavrBridge.stale && wavrBridge.state
              ? [
                  {
                    role: "system" as const,
                    content: wavrModelContext(wavrBridge.state),
                  },
                ]
              : []),
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
            reply = verifiedActionReply(
              plan.capability,
              result.result,
              plan.message,
            );
            if (plan.capability === "software.open" && isCoreDawId(plan.input.appId)) {
              setDawStatuses((current) =>
                current.map((status) =>
                  status.id === plan.input.appId
                    ? { ...status, installed: true }
                    : status,
                ),
              );
              if (plan.input.appId === "reaper") {
                setReaperStatus((current) =>
                  current ? { ...current, installed: true } : current,
                );
              }
            }
          } else {
            reply =
              "I couldn't complete that desktop action: " +
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
            : plan.kind === "action" && isCoreDawId(plan.input.appId)
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

  const finishRecordedCommand = async (recorder: PcmRecorder) => {
    if (recorderRef.current === recorder) {
      recorderRef.current = null;
    }
    setRecording(false);
    runtime.setState("UNDERSTANDING");
    runtime.notify("Transcribing locally…");

    try {
      const wav = await recorder.stop();
      const text = (await transcribeAudio(wav)).trim();
      if (!text) {
        runtime.setState("QUESTION");
        runtime.notify("I didn’t catch a command.");
        return;
      }
      await processInput(text);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      runtime.setState("ERROR");
      runtime.notify(detail);
    }
  };

  const runWakeConversation = async (event: WakeWordEvent) => {
    if (wakeCaptureBusyRef.current || recorderRef.current) return;

    setSkillManagerOpen(false);
    setPanelOpen(true);
    await unlockAudio().catch(() => undefined);

    if (!speechStatus?.whisperAvailable) {
      runtime.setState("QUESTION");
      runtime.notify(
        "Wake phrase detected, but whisper.cpp is offline. Start local speech recognition or use text input.",
      );
      return;
    }

    wakeCaptureBusyRef.current = true;
    try {
      const recorder = await startPcmRecorder();
      recorderRef.current = recorder;
      setRecording(true);
      runtime.setState("LISTENING");
      runtime.notify("I’m listening…");

      await new Promise((resolve) => window.setTimeout(resolve, 5200));

      // A manual mic click can finish the utterance early.
      if (recorderRef.current !== recorder) return;
      await finishRecordedCommand(recorder);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      runtime.setState("ERROR");
      runtime.notify(detail);
    } finally {
      wakeCaptureBusyRef.current = false;
      setPendingWakeEvent((current) =>
        current?.eventId === event.eventId &&
        current?.detectedAtMs === event.detectedAtMs
          ? null
          : current,
      );
    }
  };

  const toggleVoice = async () => {
    if (recording && recorderRef.current) {
      const recorder = recorderRef.current;
      recorderRef.current = null;
      await finishRecordedCommand(recorder);
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

  useEffect(() => {
    if (!pendingWakeEvent) return;
    void runWakeConversation(pendingWakeEvent);
  }, [pendingWakeEvent]);

  return (
    <main
      className={"aera-root" + (panelOpen ? " panel-open" : "")}
      data-state={state.toLowerCase()}
      style={paletteCssVariables(preferences.orbPalette) as CSSProperties}
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
          palette={preferences.orbPalette}
          presence={preferences.presenceStyle}
        />
        <span className="orb-aura" />
      </button>

      {skillManagerOpen && (
        <SkillManager
          providers={providers}
          speech={speechStatus}
          daws={dawStatuses}
          reaperBridge={reaperBridge}
          flStudioBridge={flStudioBridge}
          abletonBridge={abletonBridge}
          logicBridge={logicBridge}
          proToolsBridge={proToolsBridge}
          wavrBridge={wavrBridge}
          wakeWord={wakeWordStatus}
          foreground={foreground}
          visualContextEnabled={preferences.visualContextEnabled}
          visualModel={preferences.visualModel}
          ollamaModels={
            providers.find((provider) => provider.id === "ollama")?.models ?? []
          }
          busy={serviceBusy}
          onRefresh={() => refreshLocalServices()}
          onWindowPermission={enableWindowAwareness}
          onVisualContextChange={setVisualContextPreference}
          onVisualModelChange={(model) => patchPreferences({ visualModel: model })}
          onInstallReaper={installReaperCompanion}
          onInstallFlStudio={installFlStudioCompanion}
          onPrepareAbleton={prepareAbletonCompanion}
          onInstallLogic={installLogicCompanion}
          onInstallProTools={installProToolsCompanion}
          onInstallWakeWord={installWakeWordLocalCompanion}
          onComplete={() => {
            patchPreferences({ onboardingComplete: true });
            setSkillManagerOpen(false);
            setPanelOpen(true);
          }}
          onClose={() => setSkillManagerOpen(false)}
        />
      )}

      {panelOpen && !skillManagerOpen && (
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
                className={
                  dawStatuses.some((status) => status.installed)
                    ? "service-on"
                    : "service-off"
                }
                title={
                  dawStatuses.length > 0
                    ? "Detected DAWs: " +
                      (dawStatuses
                        .filter((status) => status.installed)
                        .map((status) => status.name)
                        .join(", ") || "none")
                    : "DAW detection pending"
                }
              >
                DAW {dawStatuses.filter((status) => status.installed).length}/5
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
              <span
                className={
                  reaperBridge?.available && !reaperBridge.stale
                    ? "service-on"
                    : "service-off"
                }
                title={
                  reaperBridge?.available && reaperBridge.state
                    ? "REAPER live bridge · " +
                      reaperBridge.state.projectName +
                      " · " +
                      reaperTransportLabel(reaperBridge.state)
                    : reaperBridge?.error ?? "REAPER live bridge disconnected"
                }
              >
                LIVE
              </span>
              <span
                className={
                  flStudioBridge?.available && !flStudioBridge.stale
                    ? "service-on"
                    : "service-off"
                }
                title={
                  flStudioBridge?.available && flStudioBridge.state
                    ? "FL Studio bridge · " +
                      (flStudioBridge.state.projectName ?? "untitled") +
                      " · " +
                      (flStudioBridge.state.transport.recording
                        ? "recording"
                        : flStudioBridge.state.transport.playing
                          ? "playing"
                          : "stopped")
                    : flStudioBridge?.error ?? "FL Studio bridge disconnected"
                }
              >
                FL LIVE
              </span>
              <span
                className={
                  abletonBridge?.available && !abletonBridge.stale
                    ? "service-on"
                    : "service-off"
                }
                title={
                  abletonBridge?.available && abletonBridge.state
                    ? "Ableton bridge · " +
                      (abletonBridge.state.projectName ?? "untitled")
                    : abletonBridge?.error ?? "Ableton bridge disconnected"
                }
              >
                AB LIVE
              </span>
              <span
                className={
                  logicBridge?.available && !logicBridge.stale
                    ? "service-on"
                    : "service-off"
                }
                title={
                  logicBridge?.available && logicBridge.state
                    ? "Logic bridge · " +
                      (logicBridge.state.projectName ?? "untitled")
                    : logicBridge?.error ?? "Logic bridge disconnected"
                }
              >
                LOGIC
              </span>
              <span
                className={
                  proToolsBridge?.available && !proToolsBridge.stale
                    ? "service-on"
                    : "service-off"
                }
                title={
                  proToolsBridge?.available && proToolsBridge.state
                    ? "Pro Tools bridge · " +
                      (proToolsBridge.state.projectName ?? "untitled")
                    : proToolsBridge?.error ?? "Pro Tools bridge disconnected"
                }
              >
                PT LIVE
              </span>
              <span
                className={
                  wavrBridge?.available && !wavrBridge.stale
                    ? "service-on"
                    : "service-off"
                }
                title={
                  wavrBridge?.available && wavrBridge.state
                    ? "WAVR first-party bridge · " +
                      (wavrBridge.state.projectName ?? "untitled")
                    : wavrBridge?.error ?? "WAVR bridge disconnected"
                }
              >
                WAVR
              </span>
              <span
                className={preferences.visualContextEnabled ? "service-on" : "service-off"}
                title={
                  preferences.visualContextEnabled
                    ? "Visual Context armed for explicit one-shot capture this session"
                    : "Visual Context off"
                }
              >
                VISION
              </span>
              <span
                className={
                  preferences.wakeWordEnabled && wakeWordStatus?.available
                    ? "service-on"
                    : "service-off"
                }
                title={
                  wakeWordStatus?.available
                    ? "Local wake phrase · " + (wakeWordStatus.phrase ?? "AERA")
                    : wakeWordStatus?.error ?? "Wake-word service disconnected"
                }
              >
                WAKE
              </span>
              <button
                type="button"
                className="setup-button"
                onClick={() => setSkillManagerOpen(true)}
              >
                SETUP
              </button>
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

          {reaperBridge?.available && !reaperBridge.stale && reaperBridge.state ? (
            <div className="reaper-livebar">
              <span>REAPER LIVE</span>
              <strong>{reaperBridge.state.projectName}</strong>
              <small>
                {reaperTransportLabel(reaperBridge.state)}
                {" · "}
                {reaperBridge.state.bpm.toFixed(1)} BPM
                {" · "}
                {reaperBridge.state.trackCount} tracks
                {reaperBridge.state.selectedTrack
                  ? " · selected: " +
                    reaperBridge.state.selectedTrack.index +
                    " " +
                    reaperBridge.state.selectedTrack.name
                  : ""}
              </small>
            </div>
          ) : reaperStatus?.installed ? (
            <div className="setup-strip">
              <span>REAPER INSPECTION</span>
              <small>
                {reaperBridge?.error ?? "The read-only REAPER bridge is not running."}
              </small>
              <button type="button" onClick={installReaperCompanion}>
                Install bridge file
              </button>
            </div>
          ) : null}

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

            <label className="toggle-row">
              <span>Wake word</span>
              <input
                type="checkbox"
                checked={preferences.wakeWordEnabled}
                onChange={(event) =>
                  patchPreferences({ wakeWordEnabled: event.target.checked })
                }
              />
            </label>
          </div>

          {dawStatuses.find((status) => status.id === "ableton")?.installed &&
            (!abletonBridge?.available || abletonBridge.stale) && (
              <div className="setup-strip">
                <span>ABLETON BRIDGE</span>
                <small>
                  Prepare the local bridge, then load the bundled JavaScript in a Max for Live device.
                </small>
                <button type="button" onClick={prepareAbletonCompanion}>
                  Prepare
                </button>
              </div>
            )}

          {dawStatuses.find((status) => status.id === "logic")?.installed &&
            (!logicBridge?.available || logicBridge.stale) && (
              <div className="setup-strip">
                <span>LOGIC BRIDGE</span>
                <small>
                  Install the local OSC companion, then map AERA command/feedback
                  paths in Logic Controller Assignments.
                </small>
                <button type="button" onClick={installLogicCompanion}>
                  Install companion
                </button>
              </div>
            )}

          {dawStatuses.find((status) => status.id === "protools")?.installed &&
            (!proToolsBridge?.available || proToolsBridge.stale) && (
              <div className="setup-strip">
                <span>PRO TOOLS BRIDGE</span>
                <small>
                  Install AERA's wrapper, then run it with a helper built against
                  Avid's official Scripting SDK.
                </small>
                <button type="button" onClick={installProToolsCompanion}>
                  Install wrapper
                </button>
              </div>
            )}

          {preferences.wakeWordEnabled && !wakeWordStatus?.available && (
            <div className="setup-strip">
              <span>WAKE WORD</span>
              <small>
                Install the local sherpa-onnx companion, then point it at a KWS
                model whose license fits your use. AERA does not bundle model weights.
              </small>
              <button type="button" onClick={installWakeWordLocalCompanion}>
                Install companion
              </button>
            </div>
          )}

          <section className="appearance-card" aria-label="AERA appearance">
            <div className="appearance-copy">
              <span>PERSONALITY LIGHT</span>
              <strong>Your three-color AERA</strong>
              <small>
                These colors drive the orb’s energy, waveform, particles, lights,
                and glass aura in real time.
              </small>
            </div>

            <div className="color-wheel-row">
              {(
                [
                  ["primary", "Core"],
                  ["secondary", "Energy"],
                  ["accent", "Accent"],
                ] as const
              ).map(([key, label]) => (
                <label className="color-wheel" key={key}>
                  <input
                    type="color"
                    value={preferences.orbPalette[key]}
                    onChange={(event) =>
                      patchOrbColor(key, event.target.value)
                    }
                    aria-label={"AERA " + label + " color"}
                  />
                  <span>{label}</span>
                  <small>{preferences.orbPalette[key]}</small>
                </label>
              ))}
            </div>

            <div className="presence-row">
              <label>
                <span>Presence</span>
                <select
                  value={preferences.presenceStyle}
                  onChange={(event) =>
                    patchPreferences({
                      presenceStyle: event.target.value as PresenceStyle,
                    })
                  }
                >
                  <option value="serene">Serene</option>
                  <option value="balanced">Balanced</option>
                  <option value="expressive">Expressive</option>
                </select>
              </label>

              <label>
                <span>Physical size</span>
                <select
                  value={preferences.orbSize}
                  onChange={(event) =>
                    patchPreferences({
                      orbSize: event.target.value as OrbSizePreference,
                    })
                  }
                >
                  <option value="compact">Compact</option>
                  <option value="standard">Standard</option>
                  <option value="large">Large</option>
                </select>
              </label>

              <label>
                <span>Desktop behavior</span>
                <select
                  value={preferences.spatialBehavior}
                  onChange={(event) =>
                    patchPreferences({
                      spatialAwareness: true,
                      spatialBehavior: event.target.value as SpatialBehavior,
                    })
                  }
                >
                  <option value="quiet">Quiet</option>
                  <option value="adaptive">Adaptive</option>
                  <option value="companion">Companion</option>
                </select>
              </label>

              <button type="button" onClick={resetOrbAppearance}>
                Reset look
              </button>
            </div>

            <div className="profile-save-row">
              <input
                value={appearanceProfileName}
                maxLength={32}
                onChange={(event) => setAppearanceProfileName(event.target.value)}
                placeholder="Name this look…"
                aria-label="Appearance profile name"
              />
              <button
                type="button"
                disabled={appearanceProfiles.length >= 6}
                onClick={saveCurrentAppearance}
              >
                Save look
              </button>
            </div>

            {appearanceProfiles.length > 0 && (
              <div className="appearance-profiles" aria-label="Saved AERA looks">
                {appearanceProfiles.map((profile) => (
                  <div className="appearance-profile" key={profile.id}>
                    <button
                      type="button"
                      className="profile-use"
                      onClick={() => useAppearanceProfile(profile)}
                    >
                      <span className="profile-swatches" aria-hidden="true">
                        <i style={{ background: profile.palette.primary }} />
                        <i style={{ background: profile.palette.secondary }} />
                        <i style={{ background: profile.palette.accent }} />
                      </span>
                      <span>{profile.name}</span>
                    </button>
                    <button
                      type="button"
                      className="profile-delete"
                      aria-label={"Delete " + profile.name}
                      onClick={() => removeAppearanceProfile(profile.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

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
              </small>
            )}
            {foreground?.permissionRequired && !foreground.permissionGranted && (
              <button
                type="button"
                className="permission-button"
                onClick={enableWindowAwareness}
              >
                Enable window geometry
              </button>
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
