// agent.js
const API_KEY = process.env.MOLTBOOK_API_KEY;

function getInput(name, fallback = "") {
  const key = `INPUT_${name.toUpperCase()}`;
  return (process.env[key] && process.env[key].trim()) || fallback;
}

function pickEnv(name, fallback = "") {
  return (process.env[name] && process.env[name].trim()) || fallback;
}

async function main() {
  if (!API_KEY) {
    console.error("Missing MOLTBOOK_API_KEY (GitHub secret not set).");
    process.exit(1);
  }

  // Prefer direct env vars (SUBMOLT/TITLE/CONTENT), fall back to workflow inputs
  const submolt = pickEnv("SUBMOLT", getInput("submolt", "general"));
  const title = pickEnv("TITLE", getInput("title", "Hello from LupitaAI 👋"));
  const content = pickEnv("CONTENT", getInput("content", "Triggered manually"));

  console.log("About to post:", { submolt, title, content });

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
