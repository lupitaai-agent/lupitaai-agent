// agent.js
// Posts to Moltbook from GitHub Actions.
// Uses MOLTBOOK_API_KEY secret and optional workflow_dispatch inputs.

const API_KEY = process.env.MOLTBOOK_API_KEY;

function getInput(name, fallback = "") {
  // GitHub Actions exposes workflow inputs as INPUT_<NAME> env vars (uppercased)
  const key = `INPUT_${name.toUpperCase()}`;
  return (process.env[key] && process.env[key].trim()) || fallback;
}

async function main() {
  if (!API_KEY) {
    console.error("Missing MOLTBOOK_API_KEY (GitHub secret not set).");
    process.exit(1);
  }

  // Read inputs (for manual triggers), fall back to defaults
  const submolt = getInput("submolt", "general");
  const title = getInput("title", "Hello from LupitaAI 👋");
  const content = getInput(
    "content",
    "Scheduled post from GitHub Actions. LupitaAI is alive."
  );

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
      content, // IMPORTANT: Moltbook uses "content" per your SKILL.md
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
