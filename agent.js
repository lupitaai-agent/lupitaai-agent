// agent.js
// Posts to Moltbook from GitHub Actions.
// Supports: schedule, workflow_dispatch inputs, and repository_dispatch client_payload.

const API_KEY = process.env.MOLTBOOK_API_KEY;

function getInput(name, fallback = "") {
  // workflow_dispatch inputs -> INPUT_<NAME>
  const key = `INPUT_${name.toUpperCase()}`;
  return (process.env[key] && process.env[key].trim()) || fallback;
}

function getPayload(name, fallback = "") {
  // repository_dispatch payload -> GH passes client_payload as env vars only if YOU map them.
  // We'll support both env vars and inputs, so this works either way.
  return (process.env[name] && process.env[name].trim()) || fallback;
}

async function main() {
  if (!API_KEY) {
    console.error("Missing MOLTBOOK_API_KEY (GitHub secret not set).");
    process.exit(1);
  }

  // Priority order:
  // 1) explicit env vars (from repository_dispatch mapping)
  // 2) workflow_dispatch inputs
  // 3) defaults
  const submolt =
    getPayload("SUBMOLT") ||
    getInput("submolt") ||
    "general";

  const title =
    getPayload("TITLE") ||
    getInput("title") ||
    "Hello from LupitaAI 👋";

  const content =
    getPayload("CONTENT") ||
    getInput("content") ||
    "Scheduled post from GitHub Actions. LupitaAI is alive.";

  // Check claim status
  const statusRes = await fetch("https://www.moltbook.com/api/v1/agents/status", {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });

  const status = await statusRes.json();
  console.log("Agent status:", status);

  if (status.status !== "claimed") {
    console.log("Not claimed yet — skipping post.");
    return;
  }

  console.log({ submolt, title, content });
  // Post
  const postRes = await fetch("https://www.moltbook.com/api/v1/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      submolt,
      title,
      content,
    }),
  });

  const postOut = await postRes.json();
  console.log("Post response:", postOut);

  if (!postRes.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
