// agent.js
// Robust Moltbook poster for GitHub Actions.
// Priority of post content:
// 1) repository_dispatch payload (github.event.client_payload)
// 2) workflow_dispatch inputs (INPUT_* env vars)
// 3) defaults from env (DEFAULT_*)

const API_KEY = process.env.MOLTBOOK_API_KEY;

function clean(s) {
  return typeof s === "string" ? s.trim() : "";
}

// GitHub exposes workflow_dispatch inputs as INPUT_<NAME>
function getWorkflowInput(name) {
  return clean(process.env[`INPUT_${name.toUpperCase()}`]);
}

// Defaults (set in workflow env)
function getDefault(name) {
  return clean(process.env[`DEFAULT_${name.toUpperCase()}`]);
}

// repository_dispatch payload is provided via the special env var GITHUB_EVENT_PATH (a JSON file)
function readGitHubEvent() {
  try {
    const fs = require("fs");
    const p = process.env.GITHUB_EVENT_PATH;
    if (!p) return null;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

async function httpJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { res, json };
}

async function main() {
  if (!API_KEY) {
    console.error("Missing MOLTBOOK_API_KEY (GitHub secret not set).");
    process.exit(1);
  }

  const evt = readGitHubEvent();
  const payload = evt?.client_payload || {};

  const submolt =
    clean(payload.submolt) ||
    getWorkflowInput("submolt") ||
    getDefault("submolt") ||
    "general";

  const title =
    clean(payload.title) ||
    getWorkflowInput("title") ||
    getDefault("title") ||
    "Hello from LupitaAI 👋";

  const content =
    clean(payload.content) ||
    getWorkflowInput("content") ||
    getDefault("content") ||
    "Automated post from GitHub Actions.";

  // Log what we're about to do (helps debugging without leaking secrets)
  console.log("Prepared post:", { submolt, title, content_len: content.length });

  // Check claim status (hard gate)
  const { res: stRes, json: stJson } = await httpJson(
    "https://www.moltbook.com/api/v1/agents/status",
    { headers: { Authorization: `Bearer ${API_KEY}` } }
  );

  console.log("Agent status:", stJson);

  if (!stRes.ok) {
    console.error("Status check failed.");
    process.exit(1);
  }

  if (stJson.status !== "claimed") {
    console.log("Agent not claimed — skipping post.");
    return;
  }

  // Post to Moltbook (NOTE: per SKILL.md the field is `content`)
  const { res: postRes, json: postJson } = await httpJson(
    "https://www.moltbook.com/api/v1/posts",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ submolt, title, content }),
    }
  );

  console.log("Post response:", postJson);

  // If Moltbook rate-limits (cooldown), treat as success so Actions stays green.
  if (postRes.status === 429) {
    console.log("Rate-limited by Moltbook cooldown — treating as OK.");
    return;
  }

  if (!postRes.ok) {
    console.error("Post failed.");
    process.exit(1);
  }

  console.log("Posted successfully.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
