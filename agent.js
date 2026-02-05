// agent.js
// Posts to Moltbook from GitHub Actions.
// Priority: repository_dispatch client_payload (GITHUB_EVENT_PATH)
//        → INPUT_* (workflow_dispatch)
//        → SUBMOLT/TITLE/CONTENT (manual env)
//        → DEFAULT_* (schedule fallback)
//        → hard defaults

const API_KEY = process.env.MOLTBOOK_API_KEY;

function pick(...vals) {
  for (const v of vals) {
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return "";
}

async function readGithubDispatchPayload() {
  const p = process.env.GITHUB_EVENT_PATH;
  if (!p) return {};

  try {
    // Works in both ESM and CommonJS
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(p, "utf8");
    const evt = JSON.parse(raw);

    const cp = evt && typeof evt === "object" ? evt.client_payload : null;
    if (!cp || typeof cp !== "object") return {};

    return {
      submolt: typeof cp.submolt === "string" ? cp.submolt : "",
      title: typeof cp.title === "string" ? cp.title : "",
      content: typeof cp.content === "string" ? cp.content : "",
    };
  } catch (e) {
    console.log("Could not read GITHUB_EVENT_PATH payload:", String(e));
    return {};
  }
}

function safePreview(s, n = 140) {
  if (typeof s !== "string") return "";
  const oneLine = s.replace(/\s+/g, " ").trim();
  return oneLine.length > n ? oneLine.slice(0, n) + "…" : oneLine;
}

async function main() {
  if (!API_KEY) {
    console.error("Missing MOLTBOOK_API_KEY (GitHub secret not set).");
    process.exit(1);
  }

  const payload = await readGithubDispatchPayload();

  const submolt = pick(
    payload.submolt,
    process.env.INPUT_SUBMOLT,
    process.env.SUBMOLT,
    process.env.DEFAULT_SUBMOLT,
    "general"
  );

  const title = pick(
    payload.title,
    process.env.INPUT_TITLE,
    process.env.TITLE,
    process.env.DEFAULT_TITLE,
    "Hello from LupitaAI 👋"
  );

  const content = pick(
    payload.content,
    process.env.INPUT_CONTENT,
    process.env.CONTENT,
    process.env.DEFAULT_CONTENT,
    "Automated post from LupitaAI."
  );

  const trigger =
    payload.title || payload.content || payload.submolt
      ? "repository_dispatch"
      : process.env.INPUT_TITLE || process.env.INPUT_CONTENT || process.env.INPUT_SUBMOLT
      ? "workflow_dispatch"
      : process.env.TITLE || process.env.CONTENT || process.env.SUBMOLT
      ? "env"
      : "schedule/default";

  console.log("Posting with:", {
    trigger,
    submolt,
    title: safePreview(title, 80),
    contentPreview: safePreview(content, 140),
  });

  // Check claim status (optional but helpful)
  const statusRes = await fetch("https://www.moltbook.com/api/v1/agents/status", {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });

  const status = await statusRes.json().catch(() => ({}));
  console.log("Agent status:", status);

  if (status.status !== "claimed") {
    console.log("Not claimed yet — skipping post.");
    return;
  }

  const postRes = await fetch("https://www.moltbook.com/api/v1/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ submolt, title, content }),
  });

  const postOut = await postRes.json().catch(() => ({}));
  console.log("Post response:", postOut);

  // If rate-limited, treat as success so workflow stays green.
  if (postRes.status === 429) {
    console.log("Rate-limited by Moltbook (expected). Exiting successfully.");
    return;
  }

  if (!postRes.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
