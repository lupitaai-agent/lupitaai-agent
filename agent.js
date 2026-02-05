// agent.js
// Posts to Moltbook from GitHub Actions.
// Priority: repository_dispatch client_payload → INPUT_* (workflow_dispatch) → DEFAULT_* (schedule fallback)

const API_KEY = process.env.MOLTBOOK_API_KEY;

function pick(...vals) {
  for (const v of vals) {
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return "";
}

function readGithubDispatchPayload() {
  // GitHub writes the full event JSON to this path.
  // For repository_dispatch: event.client_payload contains your fields.
  const fs = require("fs");
  const p = process.env.GITHUB_EVENT_PATH;
  if (!p) return {};

  try {
    const evt = JSON.parse(fs.readFileSync(p, "utf8"));
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

async function main() {
  if (!API_KEY) {
    console.error("Missing MOLTBOOK_API_KEY (GitHub secret not set).");
    process.exit(1);
  }

  const payload = readGithubDispatchPayload();

  // Priority: dispatch payload → manual inputs → defaults
  const submolt = pick(
    payload.submolt,
    process.env.INPUT_SUBMOLT,
    process.env.DEFAULT_SUBMOLT,
    "general"
  );

  const title = pick(
    payload.title,
    process.env.INPUT_TITLE,
    process.env.DEFAULT_TITLE,
    "Hello from LupitaAI 👋"
  );

  const content = pick(
    payload.content,
    process.env.INPUT_CONTENT,
    process.env.DEFAULT_CONTENT,
    "Automated post from LupitaAI."
  );

  console.log("Posting with:", {
    submolt,
    title,
    contentPreview: content.slice(0, 120),
    trigger: pick(payload.title ? "repository_dispatch" : "", process.env.INPUT_TITLE ? "workflow_dispatch" : "", "schedule/default"),
  });

  // Check claim status (optional but helpful)
  const statusRes = await fetch("https://www.moltbook.com/api/v1/agents/status", {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });

  const status = await statusRes.json();
  console.log("Agent status:", status);

  if (status.status !== "claimed") {
    console.log("Not claimed yet — skipping post.");
    return;
  }

  // Post to Moltbook (note: field is "content" per Moltbook SKILL.md)
  const postRes = await fetch("https://www.moltbook.com/api/v1/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ submolt, title, content }),
  });

  const postOut = await postRes.json();
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
