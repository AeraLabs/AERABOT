use std::{
    path::{Path, PathBuf},
    process::Command,
};

fn command_stdout(program: &str, args: &[&str]) -> Option<String> {
    let output = Command::new(program).args(args).output().ok()?;
    if !output.status.success() {
        return None;
    }

    let value = String::from_utf8(output.stdout).ok()?;
    let value = value.trim();
    (!value.is_empty()).then(|| value.to_owned())
}

fn emit_link_search(path: impl AsRef<Path>) -> bool {
    let path = path.as_ref();
    if !path.is_dir() {
        return false;
    }

    println!("cargo:rustc-link-search=native={}", path.display());
    true
}

fn configure_macos_swift_linking() {
    // axuielement 0.9.x builds a small Swift bridge. Its upstream build script
    // derives Swift library paths from xcode-select as if a full Xcode bundle
    // were always selected. With standalone Command Line Tools, xcode-select
    // normally returns /Library/Developer/CommandLineTools, so that derived
    // Toolchains/XcodeDefault.xctoolchain path does not exist.
    //
    // Resolve swiftc through xcrun instead. This works with either full Xcode
    // or standalone Command Line Tools and gives ld the real directory that
    // contains libswiftCompatibility*.a on Intel macOS.
    let mut found_toolchain_swift_libs = false;

    if let Some(swiftc) = command_stdout("xcrun", &["--find", "swiftc"]) {
        let swiftc = PathBuf::from(swiftc);
        if let Some(usr_dir) = swiftc.parent().and_then(Path::parent) {
            found_toolchain_swift_libs |=
                emit_link_search(usr_dir.join("lib").join("swift").join("macosx"));
            found_toolchain_swift_libs |=
                emit_link_search(usr_dir.join("lib").join("swift-5.5").join("macosx"));
        }
    }

    // Swift's own linker also searches the SDK Swift directory. Supplying it
    // here keeps the Rust final-link invocation aligned with swiftc.
    if let Some(sdk_root) = command_stdout("xcrun", &["--sdk", "macosx", "--show-sdk-path"]) {
        emit_link_search(PathBuf::from(sdk_root).join("usr").join("lib").join("swift"));
    }

    if !found_toolchain_swift_libs {
        println!(
            "cargo:warning=Could not locate the selected Swift toolchain libraries through xcrun; Intel macOS linking may fail until Command Line Tools or Xcode is repaired."
        );
    }

    // Keep the prior runtime fix. Finished apps must resolve the system Swift
    // runtime without requiring Xcode/Command Line Tools on the customer's Mac.
    println!("cargo:rustc-link-arg=-Wl,-rpath,/usr/lib/swift");
}

fn main() {
    println!("cargo:rerun-if-env-changed=DEVELOPER_DIR");
    println!("cargo:rerun-if-env-changed=SDKROOT");

    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        configure_macos_swift_linking();
    }

    tauri_build::build()
}
