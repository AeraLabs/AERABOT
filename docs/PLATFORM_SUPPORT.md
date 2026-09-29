# Platform Support

Intel macOS is a release requirement, not a compatibility afterthought.

## Current release targets

| Platform | Rust target | Runtime profile | Package status |
|---|---|---|---|
| macOS Apple Silicon | `aarch64-apple-darwin` | AERA Accelerated | ✅ Build 105 package verified |
| macOS Intel | `x86_64-apple-darwin` | AERA Standard / CPU fallback | ✅ Build 105 package verified |
| Windows 10/11 x64 | `x86_64-pc-windows-msvc` | Standard / GPU-dependent | ✅ Build 105 package verified |

Current binary source: `ec861a0087c063aa217d3cadfe96653488178d27` (Build 105).

Downloads are maintained in the repository README so users see the architecture choice and capability matrix before installing.

## Current native/platform capabilities

| Capability | macOS Apple Silicon | macOS Intel | Windows x64 |
|---|:---:|:---:|:---:|
| Transparent native orb host | ✅ | ✅ | ✅ |
| Persistent native position | ✅ | ✅ | ✅ |
| Multi-monitor awareness | ✅ | ✅ | ✅ |
| Global summon hotkey | ✅ | ✅ | ✅ |
| Foreground app identity | ✅ | ✅ | ✅ |
| Focused-window bounds | ◐ Accessibility consent | ◐ Accessibility consent | ✅ |
| Spatial placement | ◐ permission-dependent | ◐ permission-dependent | ✅ |
| Local AI adapters | ✅ | ✅ CPU-friendly fallback | ✅ |
| Local voice adapters | ✅ | ✅ | ✅ |
| First-run Skill Manager | ✅ | ✅ | ✅ |
| Wake-to-action pipeline | ◐ local services required | ◐ local services required | ◐ local services required |
| WAVR first-party bridge | ✅ | ✅ | ✅ |
| Visual/screen context | ◐ one-shot foreground capture | ◐ one-shot foreground capture | ◐ one-shot foreground capture |
| Signed production installer | ⏳ | ⏳ | ⏳ |
| Automatic updater | ⏳ | ⏳ | ⏳ |

## Release rules

1. No mandatory native dependency may be arm64-only.
2. Graphics must degrade gracefully on older Intel GPUs.
3. Intel Macs must not assume a Neural Engine.
4. The orb must remain functional when advanced local inference is unavailable.
5. Release status fails if Intel fails even when Apple Silicon passes.
6. OS-specific behavior belongs behind the native platform bridge.
7. Efficiency mode reduces geometry, particles, antialias cost, and pixel ratio without losing AERA's identity.
8. CI package success must not be described as physical-hardware soak certification.
9. macOS Accessibility and future Screen Recording access must remain explicit user permissions.
10. Unsupported integrations must report their limitation instead of simulating success.

## Still required before production release

- physical Intel Mac, Apple Silicon, and Windows launch/soak coverage
- release signing
- macOS notarization
- architecture-aware updater
- crash recovery/relaunch hardening
- long-session performance and memory testing
- completed Pro Tools SDK helper packaging
- more automatic Logic controller-assignment provisioning
- broader opt-in visual-context modes beyond the current explicit one-shot capture boundary
