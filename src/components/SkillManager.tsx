import { useMemo, useState } from "react";
import { brainIsPreparing, formatBrainProgress, type BrainStatus } from "../ai/brain";
import type { LocalProviderStatus } from "../ai/local";
import type { SpeechStatus } from "../audio/localSpeech";
import { VIBE_PROFILES, vibeDefaults } from "../core/personality";
import type {
  AeraPreferences,
  AeraVibe,
  AiProviderPreference,
  TalkBackPreference,
} from "../core/preferences";
import type { SkillSummary } from "../core/systemHealth";
import type { KnownAppStatus } from "../platform/apps";
import type { ForegroundWindowSnapshot } from "../platform/bridge";
import type { DawBridgeStatus } from "../platform/dawBridge";
import type { ReaperBridgeStatus } from "../platform/reaperState";
import type { WakeWordStatus } from "../platform/wakeword";

export interface SkillManagerProps {
  mode?: "wizard" | "advanced";
  preferences: AeraPreferences;
  providers: LocalProviderStatus[];
  brainStatus: BrainStatus | null;
  skills: SkillSummary[];
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
  onPrepareBrain(): void;
  onRepairBrain(): void;
  onPreferenceChange(patch: Partial<AeraPreferences>): void;
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

function bridgeState(
  installed: boolean,
  bridge: { available: boolean; stale: boolean } | null,
): Readiness {
  if (!installed) return "optional";
  if (bridge?.available && !bridge.stale) return "ready";
  return "partial";
}

function badgeLabel(value: Readiness) {
  if (value === "ready") return "READY";
  if (value === "partial") return "SETUP";
  if (value === "offline") return "OFFLINE";
  return "OPTIONAL";
}

const PROVIDERS: Array<{
  id: AiProviderPreference;
  label: string;
  detail: string;
}> = [
  { id: "aera", label: "AERA Brain", detail: "Built in · private · no external setup." },
  { id: "ollama", label: "Ollama", detail: "Optional external local model library." },
  { id: "llamacpp", label: "llama.cpp", detail: "Lightweight GGUF / Intel-friendly." },
  { id: "openai_local", label: "OpenAI-compatible", detail: "Any supported loopback /v1 server." },
];

export function SkillManager(props: SkillManagerProps) {
  const [step, setStep] = useState(0);
  const mode = props.mode ?? "advanced";
  const dawMap = useMemo(
    () => new Map(props.daws.map((daw) => [daw.id, daw])),
    [props.daws],
  );

  const selectedProvider =
    props.preferences.aiProvider === "auto"
      ? props.providers.find(
          (provider) =>
            provider.id === "aera" &&
            provider.available &&
            provider.models.length > 0,
        ) ??
        props.providers.find((provider) => provider.available && provider.models.length > 0) ??
        props.providers.find((provider) => provider.available)
      : props.providers.find((provider) => provider.id === props.preferences.aiProvider);

  const builtInSelected =
    props.preferences.aiProvider === "aera" ||
    (props.preferences.aiProvider === "auto" && selectedProvider?.id === "aera");
  const brainReady = builtInSelected
    ? Boolean(props.brainStatus?.ready)
    : Boolean(selectedProvider?.available && selectedProvider.models.length);
  const brainPreparing = brainIsPreparing(props.brainStatus);
  const brainProgress = formatBrainProgress(props.brainStatus);
  const whisperReady = Boolean(props.speech?.whisperAvailable);
  const piperReady = Boolean(props.speech?.piperAvailable);
  const desktopReady =
    Boolean(props.foreground?.available) &&
    (!props.foreground?.permissionRequired || Boolean(props.foreground?.permissionGranted));

  const daws: Array<{
    id: string;
    name: string;
    installed: boolean;
    state: Readiness;
    action?: () => void;
    actionLabel?: string;
  }> = [
    {
      id: "wavr",
      name: "WAVR",
      installed: Boolean(props.wavrBridge?.available),
      state: props.wavrBridge?.available && !props.wavrBridge.stale ? "ready" : "optional",
    },
    {
      id: "flstudio",
      name: "FL Studio",
      installed: Boolean(dawMap.get("flstudio")?.installed),
      state: bridgeState(Boolean(dawMap.get("flstudio")?.installed), props.flStudioBridge),
      action: props.onInstallFlStudio,
      actionLabel: "Install bridge",
    },
    {
      id: "protools",
      name: "Pro Tools",
      installed: Boolean(dawMap.get("protools")?.installed),
      state: bridgeState(Boolean(dawMap.get("protools")?.installed), props.proToolsBridge),
      action: props.onInstallProTools,
      actionLabel: "Install wrapper",
    },
    {
      id: "logic",
      name: "Logic Pro",
      installed: Boolean(dawMap.get("logic")?.installed),
      state: bridgeState(Boolean(dawMap.get("logic")?.installed), props.logicBridge),
      action: props.onInstallLogic,
      actionLabel: "Install bridge",
    },
    {
      id: "ableton",
      name: "Ableton Live",
      installed: Boolean(dawMap.get("ableton")?.installed),
      state: bridgeState(Boolean(dawMap.get("ableton")?.installed), props.abletonBridge),
      action: props.onPrepareAbleton,
      actionLabel: "Prepare",
    },
    {
      id: "reaper",
      name: "REAPER",
      installed: Boolean(dawMap.get("reaper")?.installed),
      state: bridgeState(Boolean(dawMap.get("reaper")?.installed), props.reaperBridge),
      action: props.onInstallReaper,
      actionLabel: "Install bridge",
    },
  ];

  if (mode === "wizard") {
    const steps = ["Vibe", "Brain", "Voice", "Desktop", "Creative tools", "Ready"];

    return (
      <section className="skill-manager first-run-wizard" aria-label="AERA first-run setup">
        <header className="skill-manager-header">
          <div>
            <span>WELCOME TO AERA · {step + 1}/{steps.length}</span>
            <h2>{step === 5 ? "AERA is ready." : steps[step]}</h2>
            <p>
              {step === 0 && "Choose how AERA should feel. You can change this anytime."}
              {step === 1 && "AERA prepares its own private local brain automatically. Advanced users can still choose another local provider."}
              {step === 2 && "Choose how AERA listens and responds."}
              {step === 3 && "Give AERA only the desktop awareness you want it to have."}
              {step === 4 && "AERA only asks you to connect creative tools detected on this computer."}
              {step === 5 && "Your choices are saved locally. Advanced diagnostics stay out of the way until you need them."}
            </p>
          </div>
          <button type="button" onClick={props.onClose} aria-label="Close setup">×</button>
        </header>

        <nav className="wizard-progress" aria-label="Setup progress">
          {steps.map((label, index) => (
            <span key={label} className={index === step ? "active" : index < step ? "done" : ""}>
              {index + 1}
            </span>
          ))}
        </nav>

        <div className="wizard-stage">
          {step === 0 && (
            <div className="vibe-grid">
              {(Object.keys(VIBE_PROFILES) as AeraVibe[]).map((vibe) => {
                const profile = VIBE_PROFILES[vibe];
                return (
                  <button
                    type="button"
                    key={vibe}
                    className={props.preferences.vibe === vibe ? "selected" : ""}
                    onClick={() => props.onPreferenceChange(vibeDefaults(vibe))}
                  >
                    <strong>{profile.label}</strong>
                    <small>{profile.description}</small>
                  </button>
                );
              })}
            </div>
          )}

          {step === 1 && (
            <div className="wizard-stack">
              <div className="brain-status-card">
                <span className={brainReady ? "skill-dot ready" : brainPreparing ? "skill-dot partial" : "skill-dot offline"} />
                <div>
                  <strong>
                    {brainReady
                      ? "AERA Brain ready"
                      : brainPreparing
                        ? "Preparing AERA's brain…"
                        : props.brainStatus?.state === "ERROR"
                          ? "AERA Brain needs attention"
                          : "AERA Brain will prepare itself"}
                  </strong>
                  <small>
                    {builtInSelected
                      ? [
                          props.brainStatus?.message ?? "AERA will download and verify its local brain automatically.",
                          brainProgress,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : selectedProvider?.available
                        ? selectedProvider.name + " · " + selectedProvider.models.length + " model(s)"
                        : "The selected external provider is not connected."}
                  </small>
                </div>
                {builtInSelected ? (
                  <button
                    type="button"
                    disabled={brainPreparing || props.busy || brainReady}
                    onClick={
                      props.brainStatus?.state === "ERROR"
                        ? props.onRepairBrain
                        : props.onPrepareBrain
                    }
                  >
                    {brainReady
                      ? "Ready"
                      : brainPreparing
                        ? "Preparing…"
                        : props.brainStatus?.state === "ERROR"
                          ? "Repair brain"
                          : "Prepare brain"}
                  </button>
                ) : (
                  <button type="button" disabled={props.busy} onClick={props.onRefresh}>
                    {props.busy ? "Checking…" : "Reconnect"}
                  </button>
                )}
              </div>

              <div className="provider-grid">
                {PROVIDERS.map((provider) => {
                  const status = props.providers.find((candidate) => candidate.id === provider.id);
                  return (
                    <button
                      type="button"
                      key={provider.id}
                      className={props.preferences.aiProvider === provider.id ? "selected" : ""}
                      onClick={() =>
                        props.onPreferenceChange({ aiProvider: provider.id, aiModel: "" })
                      }
                    >
                      <strong>{provider.label}</strong>
                      <small>{provider.detail}</small>
                      <em className={status?.available ? "ready" : provider.id === "aera" && brainPreparing ? "partial" : "offline"}>
                        {provider.id === "aera"
                          ? props.brainStatus?.ready
                            ? "Ready"
                            : brainPreparing
                              ? brainProgress || props.brainStatus?.state
                              : props.brainStatus?.state === "ERROR"
                                ? "Needs repair"
                                : "Built in"
                          : status?.available
                            ? status.models.length
                              ? status.models.length + " model(s)"
                              : "Connected · no model"
                            : "Not detected"}
                      </em>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className="wizard-skip"
                onClick={() => props.onPreferenceChange({ aiProvider: "auto", aiModel: "" })}
              >
                Advanced: auto-detect another local provider
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="wizard-choice-list">
              <label>
                <span><strong>Microphone</strong><small>{whisperReady ? "whisper.cpp detected" : "Local transcription is not connected yet"}</small></span>
                <input
                  type="checkbox"
                  checked={props.preferences.micEnabled}
                  onChange={(event) => props.onPreferenceChange({ micEnabled: event.target.checked })}
                />
              </label>
              <label>
                <span><strong>Talk-back</strong><small>{piperReady ? "Local Piper voice is ready" : "Text + AERA sounds still work without Piper"}</small></span>
                <select
                  value={props.preferences.talkBack}
                  onChange={(event) =>
                    props.onPreferenceChange({ talkBack: event.target.value as TalkBackPreference })
                  }
                >
                  <option value="auto">Automatic</option>
                  <option value="voice">Local voice</option>
                  <option value="text">Text only</option>
                </select>
              </label>
              <label>
                <span><strong>AERA sounds</strong><small>Soft glass, chimes and expressive state cues</small></span>
                <input
                  type="checkbox"
                  checked={!props.preferences.muted}
                  onChange={(event) => props.onPreferenceChange({ muted: !event.target.checked })}
                />
              </label>
              <label>
                <span><strong>Wake phrase</strong><small>{props.wakeWord?.available ? "Local wake service detected" : "Optional local companion"}</small></span>
                <input
                  type="checkbox"
                  checked={props.preferences.wakeWordEnabled}
                  onChange={(event) => props.onPreferenceChange({ wakeWordEnabled: event.target.checked })}
                />
              </label>
              {props.preferences.wakeWordEnabled && !props.wakeWord?.available && (
                <button type="button" className="wizard-inline-action" onClick={props.onInstallWakeWord}>
                  Install local wake companion
                </button>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="wizard-choice-list">
              <label>
                <span><strong>Window awareness</strong><small>{desktopReady ? "Foreground app + geometry ready" : "Used to avoid windows and react to your workspace"}</small></span>
                <button type="button" onClick={props.onWindowPermission}>
                  {desktopReady ? "Ready" : "Enable"}
                </button>
              </label>
              <label>
                <span><strong>Desktop movement</strong><small>Let AERA quietly reposition around active windows</small></span>
                <input
                  type="checkbox"
                  checked={props.preferences.spatialAwareness}
                  onChange={(event) => props.onPreferenceChange({ spatialAwareness: event.target.checked })}
                />
              </label>
              <label>
                <span><strong>Visual context</strong><small>Explicit one-shot capture only when you ask AERA to look</small></span>
                <input
                  type="checkbox"
                  checked={props.visualContextEnabled}
                  onChange={(event) => props.onVisualContextChange(event.target.checked)}
                />
              </label>
              {props.visualContextEnabled && (
                <label>
                  <span><strong>Vision model</strong><small>Runs locally through Ollama</small></span>
                  <select value={props.visualModel} onChange={(event) => props.onVisualModelChange(event.target.value)}>
                    <option value="">Choose a local vision model…</option>
                    {props.ollamaModels.map((model) => <option value={model} key={model}>{model}</option>)}
                  </select>
                </label>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="wizard-daw-grid">
              {daws.map((daw) => (
                <article key={daw.id} className={!daw.installed ? "unavailable" : ""}>
                  <span className={"skill-dot " + daw.state} />
                  <div>
                    <strong>{daw.name}</strong>
                    <small>
                      {!daw.installed
                        ? "Not detected"
                        : daw.state === "ready"
                          ? "Detected · connected"
                          : "Detected · connection setup available"}
                    </small>
                  </div>
                  {daw.installed && daw.state !== "ready" && daw.action && (
                    <button type="button" onClick={daw.action}>{daw.actionLabel}</button>
                  )}
                </article>
              ))}
            </div>
          )}

          {step === 5 && (
            <div className="wizard-ready">
              <div className="ready-orb-mark">✦</div>
              <strong>AERA is ready.</strong>
              <p>
                {brainReady
                  ? "Built-in brain ready."
                  : brainPreparing
                    ? "AERA is still preparing its local brain."
                    : "AERA will keep its direct Skills available while the brain finishes setup."}
                {" "}
                {props.daws.filter((daw) => daw.installed).length} creative app(s) detected.
                {" "}
                {props.skills.length} AERA Skill(s) loaded.
              </p>
            </div>
          )}
        </div>

        <footer className="wizard-footer">
          <button type="button" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>
            Back
          </button>
          {step < 5 ? (
            <button type="button" className="primary" onClick={() => setStep((value) => Math.min(5, value + 1))}>
              Continue
            </button>
          ) : (
            <button type="button" className="primary" onClick={props.onComplete}>
              Enter AERA
            </button>
          )}
        </footer>
      </section>
    );
  }

  const advancedRows = [
    {
      title: "Brain",
      state: brainReady ? "ready" : selectedProvider?.available ? "partial" : "offline",
      detail: builtInSelected
        ? props.brainStatus
          ? props.brainStatus.message +
            (brainProgress ? " · " + brainProgress : "") +
            " · " +
            props.brainStatus.model +
            " · " +
            props.brainStatus.modelDetail
          : "AERA Brain status is loading."
        : selectedProvider?.available
          ? selectedProvider.name + (selectedProvider.models.length ? " · " + selectedProvider.models.length + " model(s)" : " · no model loaded")
          : "No selected local AI runtime is reachable.",
    },
    {
      title: "Hearing",
      state: whisperReady ? "ready" : "offline",
      detail: whisperReady ? "whisper.cpp ready" : "Local transcription offline",
    },
    {
      title: "Talk-back",
      state: piperReady ? "ready" : "optional",
      detail: piperReady ? "Piper ready" : "Text + AERA sounds available",
    },
    {
      title: "Desktop awareness",
      state: desktopReady ? "ready" : "partial",
      detail: desktopReady ? "Foreground geometry verified" : "Accessibility / foreground state needs attention",
    },
  ] as const;

  return (
    <section className="skill-manager advanced-manager" aria-label="AERA advanced diagnostics">
      <header className="skill-manager-header">
        <div>
          <span>ADVANCED · DEVELOPER · DIAGNOSTICS</span>
          <h2>AERA connections</h2>
          <p>Technical state lives here so it does not clutter normal use.</p>
        </div>
        <button type="button" onClick={props.onClose} aria-label="Close diagnostics">×</button>
      </header>

      <div className="advanced-summary">
        <span>{brainReady ? "Brain connected" : "Brain needs setup"}</span>
        <span>{props.skills.length} Skills</span>
        <button type="button" disabled={props.busy} onClick={props.onRefresh}>
          {props.busy ? "Checking…" : "Recheck everything"}
        </button>
      </div>

      <div className="skill-manager-grid">
        <section className="skill-group">
          <div className="skill-group-title"><span>CORE</span><small>Brain · voice · desktop</small></div>
          {advancedRows.map((row) => (
            <article className="skill-row" key={row.title}>
              <span className={"skill-dot " + row.state} />
              <div><strong>{row.title}</strong><small>{row.detail}</small></div>
              <em className={row.state}>{badgeLabel(row.state)}</em>
            </article>
          ))}

          <div className="advanced-provider">
            <span>AI SOURCE</span>
            <select
              value={props.preferences.aiProvider}
              onChange={(event) =>
                props.onPreferenceChange({
                  aiProvider: event.target.value as AiProviderPreference,
                  aiModel: "",
                })
              }
            >
              <option value="aera">AERA Brain · built in</option>
              <option value="auto">Auto detect</option>
              <option value="ollama">Ollama</option>
              <option value="llamacpp">llama.cpp</option>
              <option value="openai_local">OpenAI-compatible local</option>
            </select>
            <small>
              {builtInSelected
                ? props.brainStatus?.ready
                  ? "Private AERA-managed runtime · no user-facing port"
                  : props.brainStatus?.message ?? "AERA-managed runtime"
                : selectedProvider?.endpoint ?? "No active endpoint"}
            </small>
            {builtInSelected && props.brainStatus?.state === "ERROR" && (
              <button type="button" onClick={props.onRepairBrain}>Repair brain</button>
            )}
          </div>

          <div className="advanced-provider">
            <span>VISION</span>
            <select value={props.visualModel} onChange={(event) => props.onVisualModelChange(event.target.value)}>
              <option value="">No vision model</option>
              {props.ollamaModels.map((model) => <option value={model} key={model}>{model}</option>)}
            </select>
            <button type="button" onClick={() => props.onVisualContextChange(!props.visualContextEnabled)}>
              {props.visualContextEnabled ? "Disable capture" : "Enable capture"}
            </button>
          </div>
        </section>

        <section className="skill-group">
          <div className="skill-group-title"><span>CREATIVE TOOLS</span><small>Detected local bridges</small></div>
          {daws.map((daw) => (
            <article className={"skill-row" + (!daw.installed ? " unavailable" : "")} key={daw.id}>
              <span className={"skill-dot " + daw.state} />
              <div>
                <strong>{daw.name}</strong>
                <small>{!daw.installed ? "Not detected" : daw.state === "ready" ? "Live bridge verified" : "Installed · setup required"}</small>
              </div>
              <em className={daw.state}>{badgeLabel(daw.state)}</em>
              {daw.installed && daw.state !== "ready" && daw.action && (
                <button type="button" onClick={daw.action}>{daw.actionLabel}</button>
              )}
            </article>
          ))}
        </section>
      </div>

      <footer className="skill-manager-footer">
        <small>Raw ports, bridge state and provider details stay here—not in the everyday menu.</small>
        <button type="button" onClick={props.onClose}>Done</button>
      </footer>
    </section>
  );
}
