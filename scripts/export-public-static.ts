import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { prisma } from "@/lib/db/prisma";
import { getPublicDiscover, getPublicRecent, toPublicRelease } from "@/lib/queries/public";

type PublicRelease = ReturnType<typeof toPublicRelease>;

const outputDir = process.env.PUBLIC_STATIC_OUT_DIR ?? "public-out";

async function main() {
  const [recentRows, discoverRows] = await Promise.all([getPublicRecent(), getPublicDiscover()]);
  const recent = recentRows.map(toPublicRelease);
  const discover = discoverRows.map(toPublicRelease);
  const generatedAt = new Date().toISOString();

  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeJson("recent.json", { generatedAt, items: recent }),
    writeJson("discover.json", { generatedAt, items: discover }),
    writeFile(path.join(outputDir, "site.webmanifest"), createManifest(), "utf8"),
    writeFile(path.join(outputDir, "index.html"), createHtml({ generatedAt, recent, discover }), "utf8")
  ]);

  console.log(
    JSON.stringify(
      {
        outputDir,
        generatedAt,
        recent: recent.length,
        discover: discover.length
      },
      null,
      2
    )
  );
}

function writeJson(name: string, payload: unknown) {
  return writeFile(path.join(outputDir, name), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export function createManifest() {
  return `${JSON.stringify(
    {
      name: "AllManga Public",
      short_name: "AllManga",
      start_url: ".",
      display: "standalone",
      background_color: "#f7f2e8",
      theme_color: "#111111",
      icons: []
    },
    null,
    2
  )}\n`;
}

export function createHtml(payload: { generatedAt: string; recent: PublicRelease[]; discover: PublicRelease[] }) {
  const embedded = safeJson(payload);
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="description" content="AllManga public-safe metadata-only manga update snapshot." />
  <link rel="manifest" href="./site.webmanifest" />
  <title>AllManga Public</title>
  <style>
    :root {
      --bg: #f7f2e8;
      --ink: #171412;
      --muted: #6f675d;
      --line: rgba(23, 20, 18, 0.12);
      --paper: rgba(255, 255, 255, 0.82);
      --accent: #ee5a24;
      --shadow: 0 12px 32px rgba(35, 25, 15, 0.08);
      --card-min: 172px;
    }
    * { box-sizing: border-box; }
    html { min-height: 100%; background: var(--bg); }
    body {
      margin: 0;
      color: var(--ink);
      font-family: ui-sans-serif, "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(238, 90, 36, 0.16), transparent 36rem),
        linear-gradient(135deg, #fbf7ee 0%, #f1e7d7 100%);
    }
    a { color: inherit; text-decoration: none; }
    button, input { font: inherit; }
    .shell { width: min(1120px, calc(100% - 20px)); margin: 0 auto; padding: 12px 0 32px; }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: grid;
      gap: 8px;
      padding: 10px 0 8px;
      background: linear-gradient(180deg, rgba(247, 242, 232, 0.96), rgba(247, 242, 232, 0.82));
      backdrop-filter: blur(10px);
    }
    .titleRow { display: flex; align-items: end; justify-content: space-between; gap: 10px; }
    h1 { margin: 0; font-size: clamp(20px, 5vw, 34px); letter-spacing: -0.06em; line-height: 0.92; }
    .meta { color: var(--muted); font-size: 11px; white-space: nowrap; }
    .controls {
      display: grid;
      grid-template-columns: 1fr auto auto auto;
      gap: 6px;
      align-items: center;
    }
    .search {
      width: 100%;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 8px 10px;
      background: rgba(255,255,255,0.72);
      color: var(--ink);
      outline: none;
    }
    .pill {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 7px 10px;
      background: rgba(255,255,255,0.68);
      color: var(--ink);
      cursor: pointer;
      white-space: nowrap;
    }
    .pill[aria-pressed="true"] { background: #171412; color: #fff8ea; border-color: #171412; }
    .note {
      color: var(--muted);
      font-size: 11px;
      line-height: 1.5;
    }
    .sectionHead {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
      margin: 18px 0 7px;
    }
    h2 { margin: 0; font-size: 15px; letter-spacing: -0.03em; }
    .count { color: var(--muted); font-size: 11px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(var(--card-min), 1fr));
      gap: 7px;
    }
    .followedWrap[hidden] { display: none; }
    .card {
      position: relative;
      min-height: 78px;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 2px 12px 12px 12px;
      background: var(--paper);
      box-shadow: var(--shadow);
      transition: transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
    }
    .card::before {
      content: "";
      position: absolute;
      inset: 0 auto 0 0;
      width: 4px;
      background: var(--accent);
    }
    .card:hover {
      transform: translateY(-1px);
      border-color: color-mix(in srgb, var(--accent), #ffffff 28%);
      box-shadow: 0 12px 30px color-mix(in srgb, var(--accent), transparent 82%);
    }
    .cardLink {
      position: absolute;
      inset: 0;
      z-index: 1;
    }
    .cardBody {
      position: relative;
      z-index: 2;
      display: grid;
      gap: 3px;
      padding: 9px 34px 8px 10px;
      pointer-events: none;
    }
    .work {
      color: #191511;
      font-size: 13px;
      font-weight: 800;
      line-height: 1.18;
      letter-spacing: -0.04em;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .sub {
      color: var(--muted);
      font-size: 10px;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .badgeRow { display: flex; flex-wrap: wrap; gap: 3px; align-items: center; }
    .badge {
      border: 1px solid rgba(23,20,18,0.1);
      border-radius: 999px;
      padding: 1px 5px;
      background: rgba(255,255,255,0.55);
      color: #3a332d;
      font-size: 9px;
      line-height: 1.45;
    }
    .date {
      position: absolute;
      right: 7px;
      bottom: 5px;
      z-index: 3;
      color: rgba(20, 16, 12, 0.45);
      font-size: 9px;
      pointer-events: none;
    }
    .follow {
      position: absolute;
      right: 5px;
      top: 5px;
      z-index: 4;
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      border: 1px solid rgba(23,20,18,0.12);
      border-radius: 999px;
      background: rgba(255,255,255,0.58);
      color: rgba(23,20,18,0.74);
      cursor: pointer;
    }
    .follow[aria-pressed="true"] { background: #171412; color: #fff8ea; }
    .empty {
      border: 1px dashed var(--line);
      border-radius: 12px;
      padding: 18px;
      color: var(--muted);
      background: rgba(255,255,255,0.46);
      font-size: 13px;
    }
    .footer { margin: 26px 0 0; color: var(--muted); font-size: 11px; line-height: 1.6; }
    @media (max-width: 560px) {
      .shell { width: min(100% - 12px, 1120px); padding-top: 8px; }
      .controls { grid-template-columns: 1fr auto auto; }
      .controls .pill:last-child { grid-column: 1 / -1; justify-self: start; }
      .grid { --card-min: 132px; gap: 5px; }
      .card { min-height: 72px; }
      .cardBody { padding: 8px 30px 7px 9px; }
      .work { font-size: 12px; }
      .meta { display: none; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <div class="titleRow">
        <h1>AllManga Public</h1>
        <div class="meta" id="generatedAt"></div>
      </div>
      <div class="controls">
        <input id="search" class="search" type="search" placeholder="タイトル・作者・サイトで検索" autocomplete="off" />
        <button id="followOnly" class="pill" type="button" aria-pressed="false">フォローだけ</button>
        <button id="densityToggle" class="pill" type="button" aria-pressed="false">密</button>
        <button id="clearFollows" class="pill" type="button">フォロー全解除</button>
      </div>
      <div class="note">公開版は metadata-only です。フォローはこの端末のブラウザだけに保存され、サーバーには送られません。</div>
    </header>

    <main>
      <section id="followedSection" class="followedWrap" hidden>
        <div class="sectionHead">
          <h2>フォロー中</h2>
          <span class="count" id="followedCount"></span>
        </div>
        <div class="grid" id="followedGrid"></div>
      </section>

      <section>
        <div class="sectionHead">
          <h2>今日と最近の更新</h2>
          <span class="count" id="recentCount"></span>
        </div>
        <div class="grid" id="recentGrid"></div>
      </section>

      <section>
        <div class="sectionHead">
          <h2>発見</h2>
          <span class="count" id="discoverCount"></span>
        </div>
        <div class="grid" id="discoverGrid"></div>
      </section>
    </main>

    <footer class="footer">
      漫画本文・画像・サムネイルは保存も再配信もしません。読むときは各カードから公式サイトへ移動します。
    </footer>
  </div>

  <script>
    window.__ALLMANGA__ = ${embedded};
  </script>
  <script>
    const DATA = window.__ALLMANGA__;
    const FOLLOW_KEY = "allmanga-public-follows-v1";
    const state = {
      query: "",
      followOnly: false,
      dense: localStorage.getItem("allmanga-public-density-v1") === "dense",
      follows: readFollows()
    };

    const labels = {
      main_episode: "更新",
      side_story: "番外編",
      illustration: "イラスト",
      hiatus_illustration: "休載イラスト",
      promotion: "PR",
      announcement: "告知",
      oneshot_discovery: "読切",
      unknown: "不明"
    };

    const siteAccents = {
      "少年ジャンプ＋": "#e52620",
      "ジャンプ＋": "#e52620",
      "マガポケ": "#1f72d2",
      "ヤンジャン＋": "#21a7d8",
      "カドコミ": "#171717",
      "ComicWalker": "#8c8f94",
      "ヤングアニマルWeb": "#e2b900",
      "マンガワン": "#f4a6b7",
      "コミックDAYS": "#ed5a2f",
      "となりのヤングジャンプ": "#9acc62",
      "となYJ": "#9acc62",
      "サンデーうぇぶり": "#f28b23",
      "うぇぶり": "#f28b23",
      "ヤンマガWeb": "#111111"
    };

    document.getElementById("generatedAt").textContent = "生成 " + formatDateTime(DATA.generatedAt);
    document.getElementById("search").addEventListener("input", (event) => {
      state.query = event.target.value.trim().toLowerCase();
      render();
    });
    document.getElementById("followOnly").addEventListener("click", (event) => {
      state.followOnly = !state.followOnly;
      event.currentTarget.setAttribute("aria-pressed", String(state.followOnly));
      render();
    });
    document.getElementById("densityToggle").addEventListener("click", (event) => {
      state.dense = !state.dense;
      event.currentTarget.setAttribute("aria-pressed", String(state.dense));
      localStorage.setItem("allmanga-public-density-v1", state.dense ? "dense" : "default");
      applyDensity();
    });
    document.getElementById("clearFollows").addEventListener("click", () => {
      if (!state.follows.size) return;
      if (!confirm("このブラウザに保存したフォローをすべて解除しますか？")) return;
      state.follows = new Set();
      writeFollows();
      render();
    });

    applyDensity();
    render();

    function render() {
      const followed = filterItems(uniqueByFollowKey([...DATA.recent, ...DATA.discover])).filter((item) => state.follows.has(followKey(item)));
      document.getElementById("followedSection").hidden = followed.length === 0 || state.followOnly;
      renderGrid("followedGrid", "followedCount", followed, "followed");
      renderGrid("recentGrid", "recentCount", filterItems(DATA.recent), "recent");
      renderGrid("discoverGrid", "discoverCount", filterItems(DATA.discover), "discover");
    }

    function filterItems(items) {
      return items.filter((item) => {
        const key = followKey(item);
        if (state.followOnly && !state.follows.has(key)) return false;
        if (!state.query) return true;
        return [item.workTitle, item.title, item.siteName, formatAuthors(item.authors)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(state.query);
      });
    }

    function renderGrid(gridId, countId, items, mode) {
      const grid = document.getElementById(gridId);
      const count = document.getElementById(countId);
      if (!grid || !count) return;
      count.textContent = items.length + "件";
      if (!items.length) {
        grid.innerHTML = '<div class="empty">表示できる更新がありません。</div>';
        return;
      }
      grid.innerHTML = items.map((item) => renderCard(item, mode)).join("");
      grid.querySelectorAll("[data-follow]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const key = event.currentTarget.getAttribute("data-follow");
          if (state.follows.has(key)) {
            state.follows.delete(key);
          } else {
            state.follows.add(key);
          }
          writeFollows();
          render();
        });
      });
    }

    function renderCard(item, mode) {
      const key = followKey(item);
      const followed = state.follows.has(key);
      const title = item.workTitle || item.title || "無題";
      const sub = mode === "discover" ? (item.title && item.title !== title ? item.title : formatAuthors(item.authors)) : item.siteName;
      const accent = siteAccents[item.siteName] || "#7d746a";
      return '<article class="card" style="--accent:' + escapeAttr(accent) + '">' +
        '<a class="cardLink" href="' + escapeAttr(item.officialUrl) + '" target="_blank" rel="noreferrer" aria-label="' + escapeAttr(title) + 'を公式サイトで開く"></a>' +
        '<button class="follow" type="button" data-follow="' + escapeAttr(key) + '" aria-pressed="' + followed + '" title="' + (followed ? "フォロー解除" : "フォロー") + '">' + (followed ? "✓" : "+") + '</button>' +
        '<div class="cardBody">' +
          '<div class="badgeRow">' +
            '<span class="badge">' + escapeHtml(item.siteName) + '</span>' +
            '<span class="badge">' + escapeHtml(labels[item.semanticKind] || item.semanticKind) + '</span>' +
          '</div>' +
          '<div class="work">' + escapeHtml(title) + '</div>' +
          '<div class="sub">' + escapeHtml(sub || "") + '</div>' +
        '</div>' +
        (mode === "discover" || mode === "followed" ? '<div class="date">' + escapeHtml(formatShortDate(item.publishedAt)) + '</div>' : '') +
      '</article>';
    }

    function uniqueByFollowKey(items) {
      const seen = new Set();
      return items.filter((item) => {
        const key = followKey(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function applyDensity() {
      document.documentElement.style.setProperty("--card-min", state.dense ? "138px" : "172px");
      const button = document.getElementById("densityToggle");
      button.setAttribute("aria-pressed", String(state.dense));
      button.textContent = state.dense ? "標準" : "密";
    }

    function readFollows() {
      try {
        const value = JSON.parse(localStorage.getItem(FOLLOW_KEY) || "[]");
        return new Set(Array.isArray(value) ? value : []);
      } catch {
        return new Set();
      }
    }

    function writeFollows() {
      localStorage.setItem(FOLLOW_KEY, JSON.stringify(Array.from(state.follows)));
    }

    function followKey(item) {
      return [item.siteName || "", item.workTitle || item.title || "", item.officialUrl || ""].join("|");
    }

    function formatAuthors(raw) {
      if (!raw) return "";
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(Boolean).join(" / ") : String(parsed || "");
      } catch {
        return String(raw);
      }
    }

    function formatShortDate(value) {
      if (!value) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return String(date.getMonth() + 1).padStart(2, "0") + "/" + String(date.getDate()).padStart(2, "0");
    }

    function formatDateTime(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return new Intl.DateTimeFormat("ja-JP", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }).format(date);
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }

    function escapeAttr(value) {
      return escapeHtml(value).replaceAll("\`", "&#96;");
    }
  </script>
</body>
</html>
`;
}

export function safeJson(value: unknown) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function isMainModule() {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}

if (isMainModule()) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
