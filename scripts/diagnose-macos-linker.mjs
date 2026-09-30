import {
  execFileSync,
} from "node:child_process";
import {
  existsSync,
  readdirSync,
} from "node:fs";
import {
  dirname,
  join,
} from "node:path";

function run(program, args = []) {
  try {
    return execFileSync(program, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const detail =
      error?.stderr?.toString?.().trim() ||
      error?.message ||
      String(error);
    return `ERROR: ${detail}`;
  }
}

function print(label, value) {
  console.log(`${label}: ${value || "(empty)"}`);
}

console.log("AERA macOS Swift linker diagnostic");
console.log("==================================");

print("Node platform", process.platform);
print("Node architecture", process.arch);

if (process.platform !== "darwin") {
  console.log("\nThis diagnostic only applies to macOS.");
  process.exit(0);
}

const developerDir = run("xcode-select", ["-p"]);
const swiftc = run("xcrun", ["--find", "swiftc"]);
const sdkRoot = run("xcrun", ["--sdk", "macosx", "--show-sdk-path"]);
const swiftVersion = run("xcrun", ["swiftc", "--version"]);

print("xcode-select -p", developerDir);
print("swiftc", swiftc);
print("macOS SDK", sdkRoot);
print("Swift", swiftVersion.replaceAll("\n", " | "));

const candidates = [];

if (!swiftc.startsWith("ERROR:")) {
  const usrDir = dirname(dirname(swiftc));
  candidates.push(join(usrDir, "lib", "swift", "macosx"));
  candidates.push(join(usrDir, "lib", "swift-5.5", "macosx"));
}

if (!sdkRoot.startsWith("ERROR:")) {
  candidates.push(join(sdkRoot, "usr", "lib", "swift"));
}

console.log("\nSwift link-search candidates");
console.log("----------------------------");

let foundCompatibilityLibraries = false;

for (const candidate of [...new Set(candidates)]) {
  if (!existsSync(candidate)) {
    console.log(`MISS  ${candidate}`);
    continue;
  }

  console.log(`FOUND ${candidate}`);
  const compatibilityLibraries = readdirSync(candidate)
    .filter((name) => /^libswiftCompatibility.*\.a$/.test(name))
    .sort();

  if (compatibilityLibraries.length > 0) {
    foundCompatibilityLibraries = true;
    for (const library of compatibilityLibraries) {
      console.log(`      ${library}`);
    }
  }
}

console.log("\nRuntime path");
console.log("------------");
console.log("/usr/lib/swift (kept as AERA's runtime LC_RPATH)");

if (!foundCompatibilityLibraries) {
  console.error(
    "\nFAIL: no libswiftCompatibility*.a archives were found in the selected Swift toolchain paths.",
  );
  console.error(
    "Repair/reinstall Apple's Command Line Tools or select a valid Xcode toolchain before rebuilding AERA.",
  );
  process.exit(1);
}

console.log(
  "\nPASS: the selected Swift toolchain exposes compatibility libraries. AERA's build.rs will add the detected toolchain and SDK directories to the final Rust link.",
);
