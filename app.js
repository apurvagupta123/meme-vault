let MEMES = [];
let activeTag = "all";

async function loadMemes() {
  const res = await fetch("memes.json?_=" + Date.now());
  MEMES = await res.json();
  renderTags();
  renderGrid();
}

function renderTags() {
  const tags = new Set();
  MEMES.forEach(m => (m.tags || []).forEach(t => tags.add(t)));
  const bar = document.getElementById("tagBar");
  bar.innerHTML = "";
  const all = document.createElement("div");
  all.className = "tag-pill" + (activeTag === "all" ? " active" : "");
  all.textContent = "All";
  all.onclick = () => { activeTag = "all"; renderTags(); renderGrid(); };
  bar.appendChild(all);
  [...tags].sort().forEach(t => {
    const pill = document.createElement("div");
    pill.className = "tag-pill" + (activeTag === t ? " active" : "");
    pill.textContent = t;
    pill.onclick = () => { activeTag = t; renderTags(); renderGrid(); };
    bar.appendChild(pill);
  });
}

function renderGrid() {
  const grid = document.getElementById("grid");
  const empty = document.getElementById("emptyState");
  const q = document.getElementById("search").value.trim().toLowerCase();

  let list = [...MEMES].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

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

  grid.innerHTML = "";
  empty.style.display = list.length ? "none" : "block";

  list.forEach(m => {
    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => openLightbox(m);

    const isVideo = m.type === "video" || m.type === "gif" && m.src.endsWith(".mp4");
    const mediaHtml = m.type === "video"
      ? `<video src="memes/${m.src}" muted loop playsinline></video>`
      : `<img src="memes/${m.src}" alt="${escapeHtml(m.title || "")}" loading="lazy">`;

    card.innerHTML = `
      <div class="media-wrap">
        ${mediaHtml}
        <div class="badge">${m.type || "image"}</div>
      </div>
      <div class="card-body">
        <p class="card-title">${escapeHtml(m.title || "Untitled")}</p>
        <div class="card-tags">${(m.tags || []).map(t => `<span>${escapeHtml(t)}</span>`).join("")}</div>
      </div>
    `;

    if (m.type === "video") {
      const vid = card.querySelector("video");
      card.addEventListener("mouseenter", () => vid.play().catch(() => {}));
      card.addEventListener("mouseleave", () => { vid.pause(); vid.currentTime = 0; });
    }

    grid.appendChild(card);
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
      <div class="card-tags">${(m.tags || []).map(t => `<span>${escapeHtml(t)}</span>`).join("")}</div>
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
document.getElementById("search").addEventListener("input", renderGrid);

loadMemes();
