import { FormEvent, useEffect, useMemo, useState } from "react";
import { OrbScene } from "./orb/OrbScene";
import { visualFor, type OrbState } from "./orb/state";
import { AeraRuntime, type RuntimeEvent } from "./core/runtime";
import {
  loadPreferences,
  savePreferences,
  type AeraPreferences,
  type GraphicsQuality,
  type MotionPreference,
} from "./core/preferences";
import { playEarcon, unlockAudio } from "./audio/earcons";
import {
  beginNativeDrag,
  getSystemProfile,
  resizeOrbHost,
  type SystemProfile,
} from "./platform/bridge";

const systemPrefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

function resolvedReducedMotion(preferences: AeraPreferences, systemValue: boolean) {
  if (preferences.motion === "reduce") return true;
  if (preferences.motion === "full") return false;
  return systemValue;
}

export function App() {
  const runtime = useMemo(() => new AeraRuntime(), []);
  const [state, setState] = useState<OrbState>(runtime.state);
  const [message, setMessage] = useState("AERA ambient");
  const [profile, setProfile] = useState<SystemProfile | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [command, setCommand] = useState("");
  const [systemReducedMotion, setSystemReducedMotion] = useState(systemPrefersReducedMotion);
  const [preferences, setPreferences] = useState<AeraPreferences>(loadPreferences);

  const reducedMotion = resolvedReducedMotion(preferences, systemReducedMotion);

  useEffect(() => {
    getSystemProfile().then(setProfile).catch(() => undefined);

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
    savePreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    const diameter = panelOpen ? 390 : visualFor(state).nativeDiameter + 64;
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

  const submitCommand = async (event: FormEvent) => {
    event.preventDefault();
    const value = command.trim();
    if (!value) return;
    await unlockAudio().catch(() => undefined);
    setMessage("“" + value + "”");
    setCommand("");
    await runtime.runInternalCommand(value);
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
            <div>
              <strong>AERA</strong>
              <span>{state.toLowerCase()}</span>
            </div>
            <button
              type="button"
              className="panel-close"
              aria-label="Close AERA controls"
              onClick={() => setPanelOpen(false)}
            >
              ×
            </button>
          </header>

          <form className="command-form" onSubmit={submitCommand}>
            <input
              autoFocus
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              placeholder="Tell AERA what to do…"
              aria-label="AERA command"
            />
            <button type="submit">Run</button>
          </form>

          <div className="state-row" aria-label="AERA modes">
            {(["AMBIENT", "LISTENING", "THINKING", "STUDIO", "DND", "SLEEPING"] as OrbState[]).map((mode) => (
              <button
                type="button"
                key={mode}
                className={state === mode ? "active" : ""}
                onClick={() => runtime.setState(mode)}
              >
                {mode === "SLEEPING" ? "Sleep" : mode[0] + mode.slice(1).toLowerCase()}
              </button>
            ))}
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

            <label className="toggle-row">
              <span>Earcons</span>
              <input
                type="checkbox"
                checked={!preferences.muted}
                onChange={(event) => patchPreferences({ muted: !event.target.checked })}
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
