const API_BASE = "https://meme-api.theapurva.com";
const VOTES_URL = "https://raw.githubusercontent.com/apurvagupta123/meme-vault/main/votes.json";

let MEMES = [];
let VOTES = {};
let activeTag = "all";

function getVoterId() {
  let id = localStorage.getItem("mv_voter_id");
  if (!id) {
    id = "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("mv_voter_id", id);
  }
  return id;
}

function getMyVote(id) {
  const raw = localStorage.getItem("mv_my_votes");
  const map = raw ? JSON.parse(raw) : {};
  return map[id] || 0;
}

function setMyVote(id, dir) {
  const raw = localStorage.getItem("mv_my_votes");
  const map = raw ? JSON.parse(raw) : {};
  if (dir === 0) delete map[id];
  else map[id] = dir;
  localStorage.setItem("mv_my_votes", JSON.stringify(map));
}

async function loadMemes() {
  const [memesRes, votesRes] = await Promise.all([
    fetch("memes.json?_=" + Date.now()),
    fetch(VOTES_URL + "?_=" + Date.now()).catch(() => null),
  ]);
  MEMES = await memesRes.json();
  VOTES = votesRes && votesRes.ok ? await votesRes.json() : {};
  renderSidebar();
  renderFeed();
}

function scoreFor(m) {
  const v = VOTES[m.id];
  if (v) return (v.up || 0) - (v.down || 0);
  return 0;
}

function formatScore(n) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1000) return sign + (abs / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return sign + String(abs);
}

function renderSidebar() {
  const tags = {};
  MEMES.forEach(m => (m.tags || []).forEach(t => { tags[t] = (tags[t] || 0) + 1; }));
  const list = document.getElementById("tagList");
  list.innerHTML = "";
  Object.keys(tags).sort().forEach(t => {
    const item = document.createElement("div");
    item.className = "sidebar-item" + (activeTag === t ? " active" : "");
    item.innerHTML = `<span class="dot"></span> ${escapeHtml(cap(t))} <span class="count">${tags[t]}</span>`;
    item.onclick = () => { activeTag = t; renderSidebar(); renderFeed(); };
    list.appendChild(item);
  });

  document.querySelector('.sidebar-item[data-tag="all"]').className =
    "sidebar-item" + (activeTag === "all" ? " active" : "");
}

document.querySelector('.sidebar-item[data-tag="all"]').onclick = () => {
  activeTag = "all"; renderSidebar(); renderFeed();
};

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function renderFeed() {
  const feed = document.getElementById("feed");
  const empty = document.getElementById("emptyState");
  const q = document.getElementById("search").value.trim().toLowerCase();

  let list = [...MEMES].sort((a, b) => scoreFor(b) - scoreFor(a) || (b.date || "").localeCompare(a.date || ""));

  if (activeTag !== "all") {
    list = list.filter(m => (m.tags || []).includes(activeTag));
  }
  if (q) {
    list = list.filter(m =>
      (m.title || "").toLowerCase().includes(q) ||
      (m.caption || "").toLowerCase().includes(q) ||
      (m.tags || []).join(" ").toLowerCase().includes(q)
    );
  }

  feed.innerHTML = "";
  empty.style.display = list.length ? "none" : "block";

  list.forEach(m => {
    const post = document.createElement("div");
    post.className = "post";

    const mediaHtml = m.type === "video"
      ? `<video src="memes/${m.src}" muted loop playsinline></video>`
      : `<img src="memes/${m.src}" alt="${escapeHtml(m.title || "")}" loading="lazy">`;

    const primaryTag = (m.tags && m.tags[0]) || "meme";
    const score = scoreFor(m);
    const myDir = getMyVote(m.id);

    post.innerHTML = `
      <div class="post-header">
        <span class="post-badge">${escapeHtml(cap(primaryTag))}</span>
        <span class="post-date">${escapeHtml(m.date || "")}</span>
      </div>
      <div class="post-title">${escapeHtml(m.title || "Untitled")}</div>
      <div class="post-media">${mediaHtml}</div>
      ${m.caption ? `<div class="post-caption">${escapeHtml(m.caption)}</div>` : ""}
      <div class="post-tags">${(m.tags || []).map(t => `<span class="tag-chip">${escapeHtml(t)}</span>`).join("")}</div>
      <div class="post-footer">
        <div class="vote-group">
          <button class="vote-btn up${myDir === 1 ? " voted" : ""}" aria-label="Upvote">&#9650;</button>
          <span class="vote-score">${formatScore(score)}</span>
          <button class="vote-btn down${myDir === -1 ? " voted" : ""}" aria-label="Downvote">&#9660;</button>
        </div>
        <button class="post-action share-action">Share</button>
      </div>
    `;

    const mediaEl = post.querySelector(".post-media");
    mediaEl.addEventListener("click", () => openLightbox(m));

    if (m.type === "video") {
      const vid = post.querySelector("video");
      post.addEventListener("mouseenter", () => vid.play().catch(() => {}));
      post.addEventListener("mouseleave", () => { vid.pause(); vid.currentTime = 0; });
    }

    const upBtn = post.querySelector(".vote-btn.up");
    const downBtn = post.querySelector(".vote-btn.down");
    const scoreEl = post.querySelector(".vote-score");

    async function castVote(dir) {
      const current = getMyVote(m.id);
      const newDir = current === dir ? 0 : dir;
      const delta = newDir - current;

      setMyVote(m.id, newDir);
      upBtn.classList.toggle("voted", newDir === 1);
      downBtn.classList.toggle("voted", newDir === -1);
      scoreEl.textContent = formatScore(score + delta);
      if (!VOTES[m.id]) VOTES[m.id] = { up: 0, down: 0 };

      upBtn.disabled = true;
      downBtn.disabled = true;

      try {
        const res = await fetch(`${API_BASE}/api/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: m.id, dir: dir, voterId: getVoterId() }),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          VOTES[m.id] = { up: data.up, down: data.down };
          scoreEl.textContent = formatScore(data.up - data.down);
        } else {
          throw new Error(data.error || "Vote failed");
        }
      } catch (e) {
        scoreEl.textContent = formatScore(scoreFor(m));
        console.error("Vote failed:", e);
      } finally {
        upBtn.disabled = false;
        downBtn.disabled = false;
      }
    }

    upBtn.onclick = () => castVote(1);
    downBtn.onclick = () => castVote(-1);

    post.querySelector(".share-action").onclick = () => {
      const url = location.origin + location.pathname + "#" + encodeURIComponent(m.id);
      navigator.clipboard?.writeText(url).catch(() => {});
      const btn = post.querySelector(".share-action");
      const original = btn.textContent;
      btn.textContent = "Link copied";
      setTimeout(() => { btn.textContent = original; }, 1500);
    };

    feed.appendChild(post);
  });
}

function openLightbox(m) {
  const lb = document.getElementById("lightbox");
  const inner = document.getElementById("lightboxInner");
  const mediaHtml = m.type === "video"
    ? `<video src="memes/${m.src}" controls autoplay loop></video>`
    : `<img src="memes/${m.src}" alt="${escapeHtml(m.title || "")}">`;
  inner.innerHTML = `
    ${mediaHtml}
    <div class="lightbox-meta">
      <h3>${escapeHtml(m.title || "Untitled")}</h3>
      <p>${escapeHtml(m.caption || "")}</p>
      <div class="post-tags" style="padding:0;">${(m.tags || []).map(t => `<span class="tag-chip">${escapeHtml(t)}</span>`).join("")}</div>
    </div>
  `;
  lb.classList.add("open");
}

function closeLightbox() {
  document.getElementById("lightbox").classList.remove("open");
  document.getElementById("lightboxInner").innerHTML = "";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

document.getElementById("closeBtn").onclick = closeLightbox;
document.getElementById("lightbox").addEventListener("click", (e) => {
  if (e.target.id === "lightbox") closeLightbox();
});
document.getElementById("search").addEventListener("input", renderFeed);

loadMemes();
