import type { FormEvent } from "react";
import type { OrbState } from "../orb/state";
import type { AeraPreferences } from "../core/preferences";

interface AeraQuickMenuProps {
  state: OrbState;
  message: string;
  command: string;
  recording: boolean;
  brainReady: boolean;
  voiceReady: boolean;
  studioName: string | null;
  preferences: AeraPreferences;
  onCommandChange(value: string): void;
  onSubmit(event: FormEvent): void;
  onVoice(): void;
  onMove(): void;
  onStudio(): void;
  onVoiceSound(): void;
  onAiConnections(): void;
  onDesktopBehavior(): void;
  onAdvanced(): void;
  onClose(): void;
  onQuit(): void;
}

export function AeraQuickMenu(props: AeraQuickMenuProps) {
  return (
    <section className="aera-quick-menu" aria-label="AERA menu">
      <header className="quick-menu-header">
        <div>
          <span>AERA</span>
          <strong>{props.message}</strong>
        </div>
        <button type="button" onClick={props.onClose} aria-label="Close AERA menu">×</button>
      </header>

      <form className="quick-talk" onSubmit={props.onSubmit}>
        <button
          type="button"
          className={props.recording ? "quick-mic recording" : "quick-mic"}
          onClick={props.onVoice}
          aria-label={props.recording ? "Stop listening" : "Talk to AERA"}
        >
          {props.recording ? "■" : "◉"}
        </button>
        <input
          autoFocus
          value={props.command}
          onChange={(event) => props.onCommandChange(event.target.value)}
          placeholder="Talk to AERA…"
          aria-label="Talk to AERA"
        />
        <button type="submit">Send</button>
      </form>

      <div className="quick-status" aria-label="AERA status">
        <span className={props.brainReady ? "ready" : "needs"}>{props.brainReady ? "Brain connected" : "Brain needs setup"}</span>
        <span className={props.voiceReady ? "ready" : "quiet"}>{props.voiceReady ? "Voice ready" : "Text + sounds"}</span>
        {props.studioName && <span className="ready">{props.studioName}</span>}
      </div>

      <div className="quick-actions">
        <button type="button" onClick={props.onMove}>
          <b>Move AERA</b><small>Alt-drag me anywhere</small>
        </button>
        <button type="button" onClick={props.onStudio}>
          <b>Studio Mode</b><small>{props.state === "STUDIO" ? "Active now" : "Focus on creative work"}</small>
        </button>
        <button type="button" onClick={props.onVoiceSound}>
          <b>Voice & Sound</b><small>{props.preferences.muted ? "Sounds off" : "Sounds on"} · {props.preferences.talkBack}</small>
        </button>
        <button type="button" onClick={props.onAiConnections}>
          <b>AI Connections</b><small>Brain status and model setup</small>
        </button>
        <button type="button" onClick={props.onDesktopBehavior}>
          <b>Desktop Behavior</b><small>{props.preferences.spatialAwareness ? props.preferences.spatialBehavior : "Paused"}</small>
        </button>
      </div>

      <footer className="quick-menu-footer">
        <button type="button" onClick={props.onAdvanced}>Advanced / Diagnostics</button>
        <button type="button" className="quit" onClick={props.onQuit}>Quit</button>
      </footer>
    </section>
  );
}
