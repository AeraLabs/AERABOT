# Platform Support

Intel macOS is a release requirement, not a compatibility afterthought.

| Platform | Rust target | Runtime profile |
|---|---|---|
| macOS Apple Silicon | `aarch64-apple-darwin` | AERA Accelerated |
| macOS Intel | `x86_64-apple-darwin` | AERA Standard / CPU fallback |
| Windows 10/11 x64 | `x86_64-pc-windows-msvc` | Standard / GPU-dependent |

Rules:

1. No mandatory native dependency may be arm64-only.
2. Graphics must degrade gracefully on older Intel GPUs.
3. Intel Macs must not assume a Neural Engine.
4. The orb must remain functional when advanced local inference is unavailable.
5. Release status fails if Intel fails even when Apple Silicon passes.
6. OS-specific behavior belongs behind the native platform bridge.
7. Efficiency mode reduces geometry, particles, antialias cost, and pixel ratio without losing AERA's identity.

Next native bridge work: active app identity, focused-window bounds, fullscreen/minimized status, workspace changes, global summon hotkey, menu-bar/tray lifecycle, startup preference, signed/notarized packaging, and an architecture-aware updater.
