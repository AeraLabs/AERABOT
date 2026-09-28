# AERA Orb Desktop Runtime

AERA Orb is the local-first desktop companion runtime for AERA: a native transparent desktop presence, realtime 3D orb renderer, spatial/window-aware behavior layer, local command core, permission journal, and future software Skill bus.

## Targets

- macOS Apple Silicon (arm64)
- macOS Intel (x86_64) — mandatory
- Windows 10/11 (x86_64)

## Architecture

- **Tauri v2 / Rust**: native transparent host, OS bridge, architecture detection, multi-monitor/window lifecycle.
- **React + TypeScript**: interaction shell and settings surfaces.
- **Three.js**: realtime glass/crystal orb rendering.
- **AERA Core**: event-driven command, permission, action, and Skill boundary independent of visuals.
- **Procedural WebAudio earcons**: lightweight audio language with no required bundled samples.

The orb renderer observes runtime state. It does not own reasoning or tool execution.

## Development

```bash
npm install
npm run tauri dev
```

## Verification

```bash
npm run typecheck
npm test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

See `docs/ARCHITECTURE.md` and `docs/PLATFORM_SUPPORT.md`.
