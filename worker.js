/**
 * MemeVault relay worker.
 *
 * Holds the GitHub token so the public site can submit memes and vote
 * without visitors needing a GitHub account. GitHub stays the source of
 * truth: submissions become Issues (with the file committed into
 * /pending/), votes are tallied in votes.json in the repo.
 *
 * Required secrets/vars (set in Cloudflare dashboard -> Worker -> Settings):
 *   GITHUB_TOKEN  - fine-grained PAT, Contents + Issues read/write, scoped
 *                   to this one repo only. (Secret)
 *   GITHUB_OWNER  - e.g. "apurvagupta123" (Variable)
 *   GITHUB_REPO   - e.g. "meme-vault"     (Variable)
 *   ALLOWED_ORIGIN - e.g. "https://meme.theapurva.com" (Variable)
 */

const GH_API = "https://api.github.com";

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data, status, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(env) },
  });
}

async function ghFetch(env, path, options = {}) {
  const res = await fetch(`${GH_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "memevault-relay",
      ...(options.headers || {}),
    },
  });
  return res;
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "meme";
}

function extFromMime(mime) {
  const map = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };
  return map[mime] || "bin";
}

async function handleSubmit(req, env) {
  const form = await req.formData();
  const title = (form.get("title") || "").toString().trim().slice(0, 120);
  const tags = (form.get("tags") || "").toString().trim().slice(0, 200);
  const caption = (form.get("caption") || "").toString().trim().slice(0, 500);
  const file = form.get("file");

  if (!title || !file || typeof file === "string") {
    return json({ error: "Title and a file are required." }, 400, env);
  }
  if (file.size > 9 * 1024 * 1024) {
    return json({ error: "File too big (9MB max)." }, 400, env);
  }

  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);

  const ext = extFromMime(file.type);
  const stamp = Date.now();
  const filename = `${slugify(title)}-${stamp}.${ext}`;
  const path = `pending/${filename}`;

  const putRes = await ghFetch(env, `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `New submission: ${title}`,
      content: b64,
    }),
  });
  if (!putRes.ok) {
    const t = await putRes.text();
    return json({ error: "Could not store file.", detail: t }, 502, env);
  }

  const rawUrl = `https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/main/${path}`;
  const isVideo = file.type.startsWith("video/");
  const mediaBlock = isVideo
    ? `[Video submission](${rawUrl})`
    : `![submission](${rawUrl})`;

  const body = [
    `**Title:** ${title}`,
    `**Tags:** ${tags || "_none given_"}`,
    `**Caption:** ${caption || "_none given_"}`,
    ``,
    mediaBlock,
    ``,
    `_File path: \`${path}\`_`,
  ].join("\n");

  const issueRes = await ghFetch(env, `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues`, {
    method: "POST",
    body: JSON.stringify({
      title: `[Meme] ${title}`,
      body,
      labels: ["submission"],
    }),
  });
  if (!issueRes.ok) {
    const t = await issueRes.text();
    return json({ error: "Could not open review issue.", detail: t }, 502, env);
  }
  const issue = await issueRes.json();

  return json({ ok: true, issue: issue.number, url: issue.html_url }, 200, env);
}

async function getVotesFile(env) {
  const res = await ghFetch(env, `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/votes.json?ref=main`);
  if (!res.ok) return { sha: null, votes: {} };
  const data = await res.json();
  const text = atob(data.content.replace(/\n/g, ""));
  let votes = {};
  try { votes = JSON.parse(text); } catch (e) { votes = {}; }
  return { sha: data.sha, votes };
}

async function handleVote(req, env) {
  const body = await req.json().catch(() => null);
  if (!body || !body.id || (body.dir !== 1 && body.dir !== -1) || !body.voterId) {
    return json({ error: "Bad request." }, 400, env);
  }
  const { id, dir, voterId } = body;

  const { sha, votes } = await getVotesFile(env);
  if (!votes[id]) votes[id] = { up: 0, down: 0, voters: {} };
  if (!votes[id].voters) votes[id].voters = {};

  const prevDir = votes[id].voters[voterId] || 0;
  if (prevDir === dir) {
    // toggling off
    if (dir === 1) votes[id].up = Math.max(0, votes[id].up - 1);
    else votes[id].down = Math.max(0, votes[id].down - 1);
    delete votes[id].voters[voterId];
  } else {
    if (prevDir === 1) votes[id].up = Math.max(0, votes[id].up - 1);
    if (prevDir === -1) votes[id].down = Math.max(0, votes[id].down - 1);
    if (dir === 1) votes[id].up += 1;
    else votes[id].down += 1;
    votes[id].voters[voterId] = dir;
  }

  const newContent = btoa(JSON.stringify(votes, null, 2));
  const putRes = await ghFetch(env, `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/votes.json`, {
    method: "PUT",
    body: JSON.stringify({
      message: `Vote: ${id}`,
      content: newContent,
      sha: sha || undefined,
    }),
  });
  if (!putRes.ok) {
    const t = await putRes.text();
    return json({ error: "Could not save vote.", detail: t }, 502, env);
  }

  return json({ ok: true, up: votes[id].up, down: votes[id].down }, 200, env);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env) });
    }

    if (url.pathname === "/api/submit" && req.method === "POST") {
      try {
        return await handleSubmit(req, env);
      } catch (e) {
        return json({ error: "Server error.", detail: String(e) }, 500, env);
      }
    }

    if (url.pathname === "/api/vote" && req.method === "POST") {
      try {
        return await handleVote(req, env);
      } catch (e) {
        return json({ error: "Server error.", detail: String(e) }, 500, env);
      }
    }

    return json({ error: "Not found." }, 404, env);
  },
};
