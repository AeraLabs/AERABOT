import type { LocalProviderStatus } from "../ai/local";
import type { SpeechStatus } from "../audio/localSpeech";
import type { KnownAppStatus } from "../platform/apps";
import type { ForegroundWindowSnapshot } from "../platform/bridge";
import type { DawBridgeStatus } from "../platform/dawBridge";
import type { ReaperBridgeStatus } from "../platform/reaperState";
import type { WakeWordStatus } from "../platform/wakeword";

export interface SkillManagerProps {
  providers: LocalProviderStatus[];
  speech: SpeechStatus | null;
  daws: KnownAppStatus[];
  reaperBridge: ReaperBridgeStatus | null;
  flStudioBridge: DawBridgeStatus | null;
  abletonBridge: DawBridgeStatus | null;
  logicBridge: DawBridgeStatus | null;
  proToolsBridge: DawBridgeStatus | null;
  wavrBridge: DawBridgeStatus | null;
  wakeWord: WakeWordStatus | null;
  foreground: ForegroundWindowSnapshot | null;
  visualContextEnabled: boolean;
  visualModel: string;
  ollamaModels: string[];
  busy?: boolean;
  onRefresh(): void;
  onWindowPermission(): void;
  onVisualContextChange(enabled: boolean): void;
  onVisualModelChange(model: string): void;
  onInstallReaper(): void;
  onInstallFlStudio(): void;
  onPrepareAbleton(): void;
  onInstallLogic(): void;
  onInstallProTools(): void;
  onInstallWakeWord(): void;
  onComplete(): void;
  onClose(): void;
}

type Readiness = "ready" | "partial" | "offline" | "optional";

function badgeLabel(value: Readiness) {
  switch (value) {
    case "ready":
      return "READY";
    case "partial":
      return "SETUP";
    case "offline":
      return "OFFLINE";
    default:
      return "OPTIONAL";
  }
}

function bridgeState(
  installed: boolean,
  bridge: { available: boolean; stale: boolean } | null,
): Readiness {
  if (!installed) return "optional";
  if (bridge?.available && !bridge.stale) return "ready";
  return "partial";
}

export function SkillManager(props: SkillManagerProps) {
  const aiProvider = props.providers.find(
    (provider) => provider.available && provider.models.length > 0,
  );
  const aiReachable = props.providers.some((provider) => provider.available);
  const whisperReady = Boolean(props.speech?.whisperAvailable);
  const piperReady = Boolean(props.speech?.piperAvailable);
  const foregroundReady =
    Boolean(props.foreground?.available) &&
    (!props.foreground?.permissionRequired ||
      Boolean(props.foreground?.permissionGranted));

  const dawMap = new Map(props.daws.map((daw) => [daw.id, daw]));
  const reaper = dawMap.get("reaper");
  const fl = dawMap.get("flstudio");
  const ableton = dawMap.get("ableton");
  const logic = dawMap.get("logic");
  const protools = dawMap.get("protools");

  const coreReady = [
    Boolean(aiProvider),
    whisperReady,
    foregroundReady,
  ].filter(Boolean).length;

  const installedDaws =
    props.daws.filter((daw) => daw.installed).length +
    (props.wavrBridge?.available ? 1 : 0);
  const liveDaws = [
    bridgeState(Boolean(reaper?.installed), props.reaperBridge),
    bridgeState(Boolean(fl?.installed), props.flStudioBridge),
    bridgeState(Boolean(ableton?.installed), props.abletonBridge),
    bridgeState(Boolean(logic?.installed), props.logicBridge),
    bridgeState(Boolean(protools?.installed), props.proToolsBridge),
    props.wavrBridge?.available && !props.wavrBridge.stale ? "ready" : "optional",
  ].filter((state) => state === "ready").length;

  const rows = [
    {
      id: "brain",
      title: "Local brain",
      detail: aiProvider
        ? aiProvider.name + " · " + aiProvider.models.length + " model" +
          (aiProvider.models.length === 1 ? "" : "s")
        : aiReachable
          ? "Runtime found, but no local model is loaded."
          : "Start Ollama, llama.cpp, or another loopback OpenAI-compatible runtime.",
      state: aiProvider ? "ready" : aiReachable ? "partial" : "offline",
    },
    {
      id: "hearing",
      title: "Hearing",
      detail: whisperReady
        ? "whisper.cpp is reachable and ready for local transcription."
        : "Start whisper.cpp on AERA’s configured local speech endpoint.",
      state: whisperReady ? "ready" : "offline",
    },
    {
      id: "voice",
      title: "Talk-back",
      detail: piperReady
        ? "Piper is reachable for fully local speech."
        : "Optional. AERA will use text and earcons without Piper.",
      state: piperReady ? "ready" : "optional",
    },
    {
      id: "wake",
      title: "Wake phrase",
      detail:
        props.wakeWord?.available && !props.wakeWord.stale
          ? (props.wakeWord.engine ?? "local KWS") +
            " · “" +
            (props.wakeWord.phrase ?? "AERA") +
            "”"
          : "Optional local wake companion. Model weights are not bundled.",
      state:
        props.wakeWord?.available && !props.wakeWord.stale
          ? "ready"
          : "optional",
      action:
        props.wakeWord?.available && !props.wakeWord.stale
          ? undefined
          : { label: "Install", run: props.onInstallWakeWord },
    },
    {
      id: "vision",
      title: "Visual context",
      detail: props.visualContextEnabled
        ? props.visualModel
          ? "Explicit one-shot capture · local model: " + props.visualModel
          : "Capture is enabled, but no local Ollama vision model is selected."
        : "Off by default. AERA captures only after an explicit Look request.",
      state: props.visualContextEnabled
        ? props.visualModel
          ? "ready"
          : "partial"
        : "optional",
      action: {
        label: props.visualContextEnabled ? "Disable" : "Enable",
        run: () => props.onVisualContextChange(!props.visualContextEnabled),
      },
    },
    {
      id: "desktop",
      title: "Desktop awareness",
      detail: foregroundReady
        ? "Foreground-app and supported window geometry are available."
        : props.foreground?.permissionRequired
          ? "Enable macOS Accessibility for verified window geometry."
          : "Waiting for native foreground-window state.",
      state: foregroundReady ? "ready" : "partial",
      action: foregroundReady
        ? undefined
        : { label: "Enable", run: props.onWindowPermission },
    },
  ] as const;

  const dawRows = [
    {
      id: "wavr",
      title: "WAVR · first-party",
      installed: Boolean(props.wavrBridge?.available),
      state:
        props.wavrBridge?.available && !props.wavrBridge.stale
          ? "ready" as const
          : "optional" as const,
      action: undefined,
    },
    {
      id: "reaper",
      title: "REAPER",
      installed: Boolean(reaper?.installed),
      state: bridgeState(Boolean(reaper?.installed), props.reaperBridge),
      action: reaper?.installed &&
        !(props.reaperBridge?.available && !props.reaperBridge.stale)
        ? { label: "Install bridge", run: props.onInstallReaper }
        : undefined,
    },
    {
      id: "flstudio",
      title: "FL Studio",
      installed: Boolean(fl?.installed),
      state: bridgeState(Boolean(fl?.installed), props.flStudioBridge),
      action: fl?.installed &&
        !(props.flStudioBridge?.available && !props.flStudioBridge.stale)
        ? { label: "Install bridge", run: props.onInstallFlStudio }
        : undefined,
    },
    {
      id: "ableton",
      title: "Ableton Live",
      installed: Boolean(ableton?.installed),
      state: bridgeState(Boolean(ableton?.installed), props.abletonBridge),
      action: ableton?.installed &&
        !(props.abletonBridge?.available && !props.abletonBridge.stale)
        ? { label: "Prepare", run: props.onPrepareAbleton }
        : undefined,
    },
    {
      id: "logic",
      title: "Logic Pro",
      installed: Boolean(logic?.installed),
      state: bridgeState(Boolean(logic?.installed), props.logicBridge),
      action: logic?.installed &&
        !(props.logicBridge?.available && !props.logicBridge.stale)
        ? { label: "Install bridge", run: props.onInstallLogic }
        : undefined,
    },
    {
      id: "protools",
      title: "Pro Tools",
      installed: Boolean(protools?.installed),
      state: bridgeState(Boolean(protools?.installed), props.proToolsBridge),
      action: protools?.installed &&
        !(props.proToolsBridge?.available && !props.proToolsBridge.stale)
        ? { label: "Install wrapper", run: props.onInstallProTools }
        : undefined,
    },
  ];

  return (
    <section className="skill-manager" aria-label="AERA Skill Manager">
      <header className="skill-manager-header">
        <div>
          <span>FIRST RUN · LOCAL SETUP</span>
          <h2>Connect AERA to your computer.</h2>
          <p>
            Nothing here requires a paid API. Green means AERA verified the
            service or bridge; setup means the app exists but still needs its
            local connection.
          </p>
        </div>
        <button type="button" onClick={props.onClose} aria-label="Close Skill Manager">
          ×
        </button>
      </header>

      <div className="skill-score">
        <strong>{coreReady}/3</strong>
        <span>core systems ready</span>
        <i />
        <strong>{liveDaws}/{Math.max(1, installedDaws)}</strong>
        <span>installed DAWs live</span>
        <button type="button" disabled={props.busy} onClick={props.onRefresh}>
          {props.busy ? "Checking…" : "Recheck"}
        </button>
      </div>

      <div className="skill-manager-grid">
        <section className="skill-group">
          <div className="skill-group-title">
            <span>AERA CORE</span>
            <small>Brain · voice · desktop</small>
          </div>
          {rows.map((row) => (
            <article className="skill-row" key={row.id}>
              <span className={"skill-dot " + row.state} />
              <div>
                <strong>{row.title}</strong>
                <small>{row.detail}</small>
              </div>
              <em className={row.state}>{badgeLabel(row.state)}</em>
              {"action" in row && row.action && (
                <button type="button" onClick={row.action.run}>
                  {row.action.label}
                </button>
              )}
            </article>
          ))}
        </section>

        <section className="skill-group">
          <div className="skill-group-title">
            <span>STUDIO SKILLS</span>
            <small>Only DAWs installed on this computer need setup</small>
          </div>
          {dawRows.map((row) => (
            <article
              className={"skill-row" + (!row.installed ? " unavailable" : "")}
              key={row.id}
            >
              <span className={"skill-dot " + row.state} />
              <div>
                <strong>{row.title}</strong>
                <small>
                  {!row.installed
                    ? "Not detected — nothing to configure."
                    : row.state === "ready"
                      ? "Installed · verified live bridge."
                      : "Installed · local bridge still needs setup."}
                </small>
              </div>
              <em className={row.state}>{badgeLabel(row.state)}</em>
              {row.action && (
                <button type="button" onClick={row.action.run}>
                  {row.action.label}
                </button>
              )}
            </article>
          ))}
        </section>
      </div>

      {props.visualContextEnabled && (
        <div className="visual-model-setup">
          <span>LOCAL VISION MODEL</span>
          <select
            value={props.visualModel}
            onChange={(event) => props.onVisualModelChange(event.target.value)}
          >
            <option value="">Choose an Ollama vision model…</option>
            {props.ollamaModels.map((model) => (
              <option value={model} key={model}>
                {model}
              </option>
            ))}
          </select>
          <small>
            AERA keeps captures local. If the selected model cannot process
            images, the request returns an error instead of a guessed answer.
          </small>
        </div>
      )}

      <footer className="skill-manager-footer">
        <small>
          You can finish setup later. AERA degrades gracefully when optional
          services are offline.
        </small>
        <button type="button" onClick={props.onComplete}>
          Enter AERA
        </button>
      </footer>
    </section>
  );
}
