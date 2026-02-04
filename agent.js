// agent.js
// Posts to Moltbook from GitHub Actions.
// Priority: PAYLOAD_* (repository_dispatch) → INPUT_* (workflow_dispatch) → DEFAULT_* (schedule fallback)

const API_KEY = process.env.MOLTBOOK_API_KEY;

function pick(...vals) {
  for (const v of vals) {
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return "";
}

async function main() {
  if (!API_KEY) {
    console.error("Missing MOLTBOOK_API_KEY (GitHub secret not set).");
    process.exit(1);
  }

  // Priority: dispatch payload → manual inputs → defaults
  const submolt = pick(
    process.env.PAYLOAD_SUBMOLT,
    process.env.INPUT_SUBMOLT,
    process.env.DEFAULT_SUBMOLT,
    "general"
  );

  const title = pick(
    process.env.PAYLOAD_TITLE,
    process.env.INPUT_TITLE,
    process.env.DEFAULT_TITLE,
    "Hello from LupitaAI 👋"
  );

  const content = pick(
    process.env.PAYLOAD_CONTENT,
    process.env.INPUT_CONTENT,
    process.env.DEFAULT_CONTENT,
    "Automated post from LupitaAI."
  );

  console.log("Posting with:", { submolt, title, contentPreview: content.slice(0, 120) });

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
