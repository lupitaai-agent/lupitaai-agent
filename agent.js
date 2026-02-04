// agent.js
// Posts to Moltbook from GitHub Actions.
// Works with workflow_dispatch inputs and repository_dispatch client_payload.

const API_KEY = process.env.MOLTBOOK_API_KEY;

function pick(...vals) {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

async function main() {
  if (!API_KEY) {
    console.error("Missing MOLTBOOK_API_KEY (GitHub secret not set).");
    process.exit(1);
  }

  const submolt = pick(process.env.SUBMOLT, "general");
  const title = pick(process.env.TITLE, "Hello from LupitaAI 👋");
  const content = pick(process.env.CONTENT, "Triggered manually");

  console.log("Will post:", { submolt, title, content });

  const statusRes = await fetch("https://www.moltbook.com/api/v1/agents/status", {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  const status = await statusRes.json();
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

  const postOut = await postRes.json();
  console.log("Post response:", postOut);

  if (!postRes.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
