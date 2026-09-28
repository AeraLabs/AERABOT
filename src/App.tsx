import { useEffect, useMemo, useState } from "react";
import { OrbScene } from "./orb/OrbScene";
import { visualFor, type OrbState } from "./orb/state";
import { AeraRuntime, type RuntimeEvent } from "./core/runtime";
import { playEarcon, unlockAudio } from "./audio/earcons";
import { beginNativeDrag, getSystemProfile, resizeOrbHost, type SystemProfile } from "./platform/bridge";

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export function App() {
  const runtime = useMemo(() => new AeraRuntime(), []);
  const [state, setState] = useState<OrbState>(runtime.state);
  const [message, setMessage] = useState("AERA ambient");
  const [profile, setProfile] = useState<SystemProfile | null>(null);
  const [muted, setMuted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);

  useEffect(() => {
    getSystemProfile().then(setProfile).catch(() => undefined);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => setReducedMotion(mq.matches);
    mq.addEventListener?.("change", onMotion);

    const unsubscribe = runtime.subscribe((event: RuntimeEvent) => {
      if (event.type === "state") {
        setState(event.state);
        setMessage("AERA " + event.state.toLowerCase());
        playEarcon(event.state, !muted).catch(() => undefined);
      }
      if (event.type === "message") setMessage(event.message);
    });

    return () => {
      unsubscribe();
      mq.removeEventListener?.("change", onMotion);
    };
  }, [runtime, muted]);

  useEffect(() => {
    const diameter = visualFor(state).nativeDiameter + 64;
    resizeOrbHost(diameter).catch(() => undefined);
  }, [state]);

  const activate = async () => {
    await unlockAudio().catch(() => undefined);
    if (state === "SLEEPING" || state === "AMBIENT" || state === "DND") runtime.setState("AWAKE");
    else runtime.setState("LISTENING");
  };

  const cycleState = () => {
    const order: OrbState[] = ["AMBIENT", "AWAKE", "LISTENING", "THINKING", "ACTING", "SUCCESS", "STUDIO", "SLEEPING"];
    const index = order.indexOf(state);
    runtime.setState(order[(index + 1 + order.length) % order.length]);
  };

  return (
    <main className="aera-root" data-state={state.toLowerCase()}>
      <button
        className="orb-hit-area"
        aria-label={message}
        onClick={activate}
        onDoubleClick={cycleState}
        onPointerDown={(event) => {
          if (event.button === 0 && event.altKey) beginNativeDrag().catch(() => undefined);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          setMuted((value) => !value);
        }}
      >
        <OrbScene state={state} reducedMotion={reducedMotion} />
        <span className="orb-aura" />
      </button>

      <section className="status-card" aria-live="polite">
        <strong>{state}</strong>
        <span>{message}</span>
        {profile && <small>{profile.platform} · {profile.architecture}</small>}
      </section>

      <div className="dev-hint" aria-hidden="true">
        click: summon · double-click: state demo · alt-drag: move · right-click: {muted ? "unmute" : "mute"}
      </div>
    </main>
  );
}
