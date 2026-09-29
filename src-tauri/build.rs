fn main() {
    // xcap's macOS capture backend links Swift runtime libraries. Intel macOS
    // binaries can reference those as @rpath/libswift*.dylib, so make the
    // system Swift runtime location explicit in the final Mach-O.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        println!("cargo:rustc-link-arg=-Wl,-rpath,/usr/lib/swift");
    }

    tauri_build::build()
}
