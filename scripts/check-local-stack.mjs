const endpoints = [
  {
    name: "Ollama",
    url: "http://127.0.0.1:11434/api/tags",
    parse: async (response) => {
      const value = await response.json();
      const models = Array.isArray(value.models)
        ? value.models.map((model) => model.name).filter(Boolean)
        : [];
      return models.length ? models.join(", ") : "connected; no models listed";
    },
  },
  {
    name: "llama.cpp",
    url: "http://127.0.0.1:8080/v1/models",
    parse: async (response) => {
      const value = await response.json();
      const models = Array.isArray(value.data)
        ? value.data.map((model) => model.id).filter(Boolean)
        : [];
      return models.length ? models.join(", ") : "connected; no model listed";
    },
  },
  {
    name: "whisper.cpp",
    url: "http://127.0.0.1:8081/",
    parse: async () => "speech-to-text endpoint reachable",
  },
  {
    name: "Piper",
    url: "http://127.0.0.1:5000/info",
    parse: async () => "text-to-speech endpoint reachable",
  },
];

const custom = process.env.AERA_OPENAI_LOCAL_URL?.trim();
if (custom) {
  endpoints.push({
    name: "OpenAI-compatible local",
    url: custom.replace(/\/$/, "") + "/models",
    parse: async (response) => {
      const value = await response.json();
      const models = Array.isArray(value.data)
        ? value.data.map((model) => model.id).filter(Boolean)
        : [];
      return models.length ? models.join(", ") : "connected; no models listed";
    },
  });
}

async function probe(endpoint) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1800);

  try {
    const response = await fetch(endpoint.url, { signal: controller.signal });
    if (!response.ok) {
      return { ...endpoint, ok: false, detail: "HTTP " + response.status };
    }

    let detail = "reachable";
    try {
      detail = await endpoint.parse(response);
    } catch {
      detail = "reachable; response format was not recognized";
    }

    return { ...endpoint, ok: true, detail };
  } catch (error) {
    const detail =
      error?.name === "AbortError"
        ? "timed out"
        : error instanceof Error
          ? error.message
          : String(error);
    return { ...endpoint, ok: false, detail };
  } finally {
    clearTimeout(timeout);
  }
}

console.log("\nAERA local stack\n" + "─".repeat(60));
const results = await Promise.all(endpoints.map(probe));

for (const result of results) {
  const mark = result.ok ? "✓" : "○";
  console.log(`${mark} ${result.name.padEnd(24)} ${result.detail}`);
}

console.log("─".repeat(60));
console.log("Offline entries are optional. AERA degrades gracefully.\n");

process.exitCode = results.some((result) => result.ok) ? 0 : 2;
