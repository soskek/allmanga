/* eslint-disable @next/next/no-head-element -- This component also renders a standalone static HTML document for GitHub Pages. */
import React from "react";
import type { CSSProperties, ReactNode } from "react";
import { appBackgroundCss, buildCssGridBreakpoints, designColors, fontFamilySansCss, pageMaxWidthPx } from "@/lib/design-tokens";
import { siteBaseUrls, siteDisplayOrder, siteIconUrls, siteLabels, siteMarks } from "@/lib/domain";
import type { PublicHomeCard, PublicHomeView } from "@/lib/queries/public-home";

const DISCOVER_PREVIEW_LIMIT = 30;
const PUBLIC_PAGE_DESCRIPTION =
  "AllMangaは、公式Webマンガサイトの更新・読切・新連載を横断して確認できる軽量な更新インデックスです。";

export const PUBLIC_HOME_CSS = `
:root {
  --bg: ${designColors.pageBg};
  --sand: ${designColors.sand};
  --ink: ${designColors.ink};
  --muted: rgba(16, 19, 22, 0.48);
  --line: rgba(16, 19, 22, 0.10);
  --accent: #ee5a24;
  color-scheme: light;
}
* { box-sizing: border-box; }
html { min-height: 100%; background: var(--bg); }
body {
  margin: 0;
  min-height: 100%;
  color: var(--ink);
  font-family: ${fontFamilySansCss};
  font-size: 12px;
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
  background:
    ${appBackgroundCss};
}
a { color: inherit; text-decoration: none; }
button, input { font: inherit; }
.contents { display: contents; }
.publicShell { width: min(${pageMaxWidthPx}px, calc(100% - 16px)); margin: 0 auto; padding: 3px 0 24px; }
.publicTopbar {
  display: grid;
  gap: 4px;
  padding: 3px 0 5px;
  border-bottom: 1px solid rgba(16,19,22,0.08);
  background: transparent;
}
.publicTitleRow { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.publicBrandGroup { min-width: 0; display: flex; align-items: center; gap: 8px; }
.publicTitle { margin: 0; color: rgba(16,19,22,0.58); font-size: 10px; font-weight: 600; letter-spacing: 0.14em; line-height: 1; text-transform: uppercase; }
.publicMeta { color: rgba(16, 19, 22, 0.42); font-size: 10px; white-space: nowrap; }
.publicSiteDock {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.publicSiteDock::-webkit-scrollbar { display: none; }
.publicSiteLink {
  flex: 0 0 auto;
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 1px solid rgba(16,19,22,0.08);
  border-radius: 6px;
  background: rgba(255,255,255,0.76);
  color: rgba(16,19,22,0.70);
  font-size: 8px;
  font-weight: 900;
  overflow: hidden;
}
.publicSiteLink:hover { background: rgba(255,255,255,0.92); border-color: rgba(16,19,22,0.16); }
.publicSiteIcon { width: 14px; height: 14px; object-fit: contain; }
.publicToolbar {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) auto;
  align-items: center;
  gap: 6px;
}
.publicSearch {
  width: 100%;
  min-width: 0;
  height: 36px;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 0 10px;
  background: #fff;
  color: var(--ink);
  outline: none;
  box-shadow: 0 1px 2px rgba(15,23,42,0.04);
}
.publicSearch::placeholder { color: rgba(16,19,22,0.35); }
.publicTabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding: 1px 0 0;
  scrollbar-width: none;
}
.publicTabs::-webkit-scrollbar { display: none; }
.publicHeaderActions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  min-width: 0;
}
.publicTab {
  flex: 0 0 auto;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 4px 6px;
  background: transparent;
  color: rgba(16,19,22,0.70);
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
}
.publicTab:hover,
.publicTab[aria-selected="true"] {
  border-color: transparent;
  background: rgba(255,255,255,0.70);
  color: rgba(16,19,22,0.76);
}
.publicToolButton {
  flex: 0 0 auto;
  border: 1px solid rgba(16,19,22,0.08);
  border-radius: 6px;
  padding: 4px 6px;
  background: rgba(255,255,255,0.44);
  color: rgba(16,19,22,0.54);
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
}
.publicToolButton:hover { background: rgba(255,255,255,0.78); color: rgba(16,19,22,0.72); }
.publicFileInput { display: none; }
.publicPanel[hidden] { display: none; }
.publicSectionHead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin: 8px 0 4px;
}
.publicSectionTitle { margin: 0; font-size: 12px; font-weight: 600; letter-spacing: -0.02em; }
.publicCount { color: rgba(16, 19, 22, 0.42); font-size: 10px; }
.publicGrid {
  display: grid;
  gap: 2px;
}
${buildCssGridBreakpoints(".publicGrid", "default")}
.publicFollowed[hidden] { display: none; }
.publicCard {
  position: relative;
  min-height: 42px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 13px 5px 9px 5px;
  background: linear-gradient(135deg, #ffffff 0%, #ffffff 68%, color-mix(in srgb, var(--accent), transparent 88%) 100%);
  box-shadow: 0 1px 2px rgba(15,23,42,0.06);
  transition: transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
}
.publicCard::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 2px;
  background: var(--accent);
}
.publicCard::after {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--accent);
}
.publicCard:hover {
  transform: translateY(-1px);
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent), 0 5px 14px rgba(15,23,42,0.10);
}
.publicCardLink {
  position: absolute;
  inset: 0;
  z-index: 1;
}
.publicCardBody {
  position: relative;
  z-index: 2;
  display: grid;
  min-height: 42px;
  align-items: center;
  padding: 5px 22px 5px 7px;
  pointer-events: none;
}
.publicWork {
  color: rgba(16,19,22,0.86);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.05;
  letter-spacing: -0.04em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.publicSiteMark {
  margin-right: 2px;
  color: var(--accent);
  font-size: 7px;
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.04em;
}
.publicBadgeRow {
  position: absolute;
  bottom: 3px;
  left: 5px;
  z-index: 3;
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  align-items: center;
  pointer-events: none;
}
.publicBadge {
  border-radius: 3px;
  padding: 1px 4px;
  background: rgba(16,19,22,0.06);
  color: rgba(16,19,22,0.52);
  font-size: 7px;
  font-weight: 600;
  line-height: 1;
}
.publicDateDivider {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  color: rgba(16,19,22,0.40);
  font-size: 9px;
  font-weight: 600;
}
.publicDateDivider span:first-child {
  border-radius: 3px;
  background: rgba(16,19,22,0.045);
  padding: 2px 6px;
  line-height: 1;
}
.publicDateDivider span:last-child {
  height: 1px;
  flex: 1;
  background: rgba(16,19,22,0.055);
}
.publicHiddenLine {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
  color: rgba(16,19,22,0.42);
  font-size: 10px;
}
.publicFollowButton {
  position: absolute;
  right: 3px;
  bottom: 3px;
  z-index: 4;
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border: 1px solid rgba(16,19,22,0.12);
  border-radius: 999px;
  background: rgba(255,255,255,0.52);
  color: rgba(16,19,22,0.52);
  cursor: pointer;
  font-size: 10px;
  line-height: 1;
  opacity: 0.42;
  transition: opacity 120ms ease, background 120ms ease, color 120ms ease;
}
.publicCard:hover .publicFollowButton { opacity: 0.95; }
.publicFollowButton[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: #fff; opacity: 0.9; }
.publicMoreCard {
  min-height: 42px;
  display: grid;
  align-content: center;
  justify-items: start;
  gap: 3px;
  border: 1px dashed rgba(238,90,36,0.38);
  border-radius: 13px 5px 9px 5px;
  padding: 6px 8px;
  background: rgba(255,255,255,0.42);
  color: rgba(16,19,22,0.74);
  font-weight: 600;
  letter-spacing: -0.04em;
  cursor: pointer;
  transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
}
.publicMoreCard:hover {
  transform: translateY(-1px);
  border-color: rgba(238,90,36,0.74);
  background: rgba(255,255,255,0.78);
}
.publicMoreCard span {
  color: rgba(16,19,22,0.42);
  font-size: 9px;
  font-weight: 600;
}
.publicEmpty {
  border: 1px dashed var(--line);
  border-radius: 8px;
  padding: 12px;
  color: var(--muted);
  background: rgba(255,255,255,0.46);
  font-size: 12px;
}
@media (max-width: 560px) {
  .publicShell { width: min(100% - 8px, ${pageMaxWidthPx}px); padding-top: 4px; }
  .publicGrid { gap: 2px; }
  .publicWork { font-size: 11.5px; }
  .publicHiddenLine { font-size: 9px; }
  .publicMeta { display: none; }
  .publicTitleRow { align-items: flex-start; }
  .publicBrandGroup { flex: 1; align-items: flex-start; gap: 6px; }
  .publicSiteDock { padding-bottom: 1px; }
  .publicToolbar { grid-template-columns: 1fr; gap: 3px; }
  .publicHeaderActions { justify-content: space-between; }
}
@media (min-width: 640px) {
  .publicWork { font-size: 12.5px; }
}
`;

export function PublicHomeDocument({ data }: { data: PublicHomeView }) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light" />
        <meta name="description" content={PUBLIC_PAGE_DESCRIPTION} />
        <meta property="og:title" content="AllManga" />
        <meta property="og:description" content={PUBLIC_PAGE_DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="AllManga" />
        <meta name="twitter:description" content={PUBLIC_PAGE_DESCRIPTION} />
        <link rel="manifest" href="./site.webmanifest" />
        <title>AllManga</title>
        <style dangerouslySetInnerHTML={{ __html: PUBLIC_HOME_CSS }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJson({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "AllManga",
              description: PUBLIC_PAGE_DESCRIPTION,
              inLanguage: "ja",
              isAccessibleForFree: true,
              url: "https://soskek.github.io/allmanga/"
            })
          }}
        />
      </head>
      <body>
        <PublicHome data={data} includeStyle={false} includeScript />
      </body>
    </html>
  );
}

export function PublicHome({
  data,
  includeStyle = true,
  includeScript = true
}: {
  data: PublicHomeView;
  includeStyle?: boolean;
  includeScript?: boolean;
}) {
  return (
    <>
      {includeStyle ? <style dangerouslySetInnerHTML={{ __html: PUBLIC_HOME_CSS }} /> : null}
      <div className="publicShell">
        <header className="publicTopbar">
          <div className="publicTitleRow">
            <div className="publicBrandGroup">
              <h1 className="publicTitle">AllManga</h1>
              <SiteDock />
            </div>
            <div className="publicMeta" id="generatedAt">
              {data.lastSyncedAt ? "同期" : "生成"} {formatDateTime(data.lastSyncedAt ?? data.generatedAt)}
            </div>
          </div>
          <div className="publicToolbar">
            <input id="search" className="publicSearch" type="search" placeholder="タイトル・作者・サイトで検索" autoComplete="off" />
            <div className="publicHeaderActions">
              <div className="publicTabs" role="tablist" aria-label="表示切替">
                <button className="publicTab" type="button" role="tab" data-public-tab="updates" aria-selected="true">
                  更新
                </button>
                <button className="publicTab" type="button" role="tab" data-public-tab="discover" aria-selected="false">
                  発見 {data.discover.length}
                </button>
              </div>
              <button id="exportFollows" className="publicToolButton" type="button" title="この端末のフォローをJSONで書き出す">
                書出
              </button>
              <button id="importFollows" className="publicToolButton" type="button" title="書き出したフォローJSONを取り込む">
                取込
              </button>
              <input id="importFollowsFile" className="publicFileInput" type="file" accept="application/json,.json" />
            </div>
          </div>
        </header>

        <main>
          <section id="followedSection" className="publicFollowed" hidden>
            <div className="publicSectionHead">
              <h2 className="publicSectionTitle">フォロー中</h2>
              <span className="publicCount" id="followedCount"></span>
            </div>
            <div className="publicGrid" id="followedGrid"></div>
          </section>

          <div id="updatesPanel" className="publicPanel" role="tabpanel">
            <PublicSection id="todaySection" title="今日の更新" count="サイト順">
              <div className="publicGrid" id="todayGrid">
                {data.today.map((item) => (
                  <PublicCard key={`${item.id}-${item.officialUrl}`} item={item} mode="today" />
                ))}
              </div>
            </PublicSection>

            <PublicSection id="discoverPreviewSection" title="発見" count={`${Math.min(DISCOVER_PREVIEW_LIMIT, data.discover.length)} / ${data.discover.length}件`}>
              <div className="publicGrid" id="discoverPreviewGrid">
                {data.discover.slice(0, DISCOVER_PREVIEW_LIMIT).map((item) => (
                  <PublicCard key={`${item.id}-${item.officialUrl}`} item={item} mode="discover" />
                ))}
                {data.discover.length > DISCOVER_PREVIEW_LIMIT ? (
                  <DiscoverMoreCard total={data.discover.length} remaining={data.discover.length - DISCOVER_PREVIEW_LIMIT} />
                ) : null}
              </div>
            </PublicSection>

            <section id="hiddenSection" className="publicHiddenLine">
              <span>非表示 {data.hiddenCount}件</span>
              <span>
                PR {data.hiddenBreakdown.promotion} / 告知 {data.hiddenBreakdown.announcement}
              </span>
            </section>

            <PublicSection id="recentSection" title="少し前の更新" count="最大7日">
              <div className="publicGrid" id="recentGrid">
                {data.recentGroups.map((group) => (
                  <div key={group.key} className="contents">
                    <DateDivider label={group.label} />
                    {group.items.map((item) => (
                      <PublicCard key={`${item.id}-${item.officialUrl}`} item={item} mode="recent" />
                    ))}
                  </div>
                ))}
              </div>
            </PublicSection>
          </div>

          <div id="discoverPanel" className="publicPanel" role="tabpanel" hidden>
            <PublicSection id="discoverSection" title="発見一覧" count={`${data.discover.length}件`}>
              <div className="publicGrid" id="discoverGrid">
                {data.discover.map((item) => (
                  <PublicCard key={`${item.id}-${item.officialUrl}`} item={item} mode="discover" />
                ))}
              </div>
            </PublicSection>
          </div>
        </main>
      </div>
      {includeScript ? (
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__ALLMANGA__ = ${safeJson(data)};\n${PUBLIC_HOME_SCRIPT}`
          }}
        />
      ) : null}
    </>
  );
}

function PublicSection({ id, title, count, children }: { id?: string; title: string; count: string; children: ReactNode }) {
  return (
    <section id={id}>
      <div className="publicSectionHead">
        <h2 className="publicSectionTitle">{title}</h2>
        <span className="publicCount">{count}</span>
      </div>
      {children}
    </section>
  );
}

function DateDivider({ label }: { label: string }) {
  return (
    <div className="publicDateDivider">
      <span>{label}</span>
      <span />
    </div>
  );
}

function SiteDock() {
  return (
    <nav className="publicSiteDock" aria-label="公式サイト">
      {siteDisplayOrder.map((siteId) => (
        <a
          key={siteId}
          className="publicSiteLink"
          href={siteBaseUrls[siteId]}
          target="_blank"
          rel="noreferrer"
          title={`${siteLabels[siteId] ?? siteId}を開く`}
          aria-label={`${siteLabels[siteId] ?? siteId}を開く`}
        >
          {siteIconUrls[siteId] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="publicSiteIcon" src={siteIconUrls[siteId]} alt="" loading="lazy" />
          ) : (
            siteMarks[siteId] ?? siteId.slice(0, 2).toUpperCase()
          )}
        </a>
      ))}
    </nav>
  );
}

function DiscoverMoreCard({ total, remaining }: { total: number; remaining: number }) {
  return (
    <button className="publicMoreCard" type="button" data-public-tab="discover" aria-label="発見一覧を開く">
      発見一覧へ
      <span>
        さらに{remaining}件 / 全{total}件
      </span>
    </button>
  );
}

function PublicCard({ item, mode }: { item: PublicHomeCard; mode: "discover" | "today" | "recent" | "followed" }) {
  const badges = buildBadges(item, mode);
  return (
    <article className="publicCard" style={{ "--accent": item.siteAccent } as CSSProperties}>
      <a className="publicCardLink" href={item.officialUrl} target="_blank" rel="noreferrer" aria-label={`${item.title}を公式サイトで開く`} />
      <button
        className="publicFollowButton"
        type="button"
        data-follow={followKey(item)}
        aria-pressed="false"
        title="フォロー"
      >
        +
      </button>
      <div className="publicCardBody">
        <div className="publicWork">
          <span className="publicSiteMark" title={item.siteName}>
            {item.siteMark}
          </span>
          {item.title}
        </div>
      </div>
      {badges.length ? (
        <div className="publicBadgeRow">
          {badges.map((badge) => (
            <span key={badge} className="publicBadge">
              {badge}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function buildBadges(item: PublicHomeCard, mode: "discover" | "today" | "recent" | "followed") {
  const badges: string[] = [];
  if (mode === "discover" || mode === "followed") {
    const date = formatShortDate(item.publishedAt);
    if (date) {
      badges.push(date);
    }
  }
  return badges;
}

function followKey(item: PublicHomeCard) {
  return [item.siteId, item.title, item.officialUrl].join("|");
}

function formatShortDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function safeJson(value: unknown) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

export const PUBLIC_HOME_SCRIPT = `
const DATA = window.__ALLMANGA__;
const FOLLOW_KEY = "allmanga-public-follows-v1";
const EXPORT_VERSION = 1;
const state = {
  query: "",
  tab: "updates",
  follows: readStringSet(FOLLOW_KEY)
};
bindTabButtons(document);
bindFollowBackupButtons();
document.getElementById("search")?.addEventListener("input", (event) => {
  state.query = event.target.value.trim().toLowerCase();
  render();
});
render();

function render() {
  const flatRecent = DATA.recentGroups.flatMap((group) => group.items);
  const followed = filterItems(uniqueByFollowKey([...DATA.discover, ...DATA.today, ...flatRecent]))
    .filter((item) => state.follows.has(followKey(item)));
  syncTabs();
  document.getElementById("followedSection").hidden = followed.length === 0;
  renderGrid("followedGrid", "followedCount", followed, "followed");
  renderDiscoverPreview();
  renderGrid("discoverGrid", null, filterItems(DATA.discover), "discover");
  renderGrid("todayGrid", null, filterItems(DATA.today), "today");
  renderRecentGroups();
  renderHiddenLine();
}
function bindTabButtons(root) {
  root.querySelectorAll("[data-public-tab]").forEach((button) => {
    button.onclick = () => {
      state.tab = button.getAttribute("data-public-tab") || "updates";
      render();
    };
  });
}
function syncTabs() {
  const isDiscover = state.tab === "discover";
  const updatesPanel = document.getElementById("updatesPanel");
  const discoverPanel = document.getElementById("discoverPanel");
  if (updatesPanel) updatesPanel.hidden = isDiscover;
  if (discoverPanel) discoverPanel.hidden = !isDiscover;
  document.querySelectorAll("[data-public-tab]").forEach((button) => {
    const selected = button.getAttribute("data-public-tab") === state.tab;
    button.setAttribute("aria-selected", String(selected));
  });
}
function renderDiscoverPreview() {
  const grid = document.getElementById("discoverPreviewGrid");
  if (!grid) return;
  const items = filterItems(DATA.discover);
  if (!items.length) {
    grid.innerHTML = '<div class="publicEmpty">表示できる更新がありません。</div>';
    return;
  }
  const shown = items.slice(0, ${DISCOVER_PREVIEW_LIMIT});
  const remaining = Math.max(items.length - shown.length, 0);
  grid.innerHTML = shown.map((item) => renderCard(item, "discover")).join("") +
    (remaining > 0 ? renderMoreCard(items.length, remaining) : "");
  bindFollowButtons(grid);
  bindTabButtons(grid);
}
function filterItems(items) {
  return items.filter((item) => {
    if (!state.query) return true;
    return [item.title, item.siteName, formatAuthors(item.authors)].filter(Boolean).join(" ").toLowerCase().includes(state.query);
  });
}
function renderGrid(gridId, countId, items, mode) {
  const grid = document.getElementById(gridId);
  const count = countId ? document.getElementById(countId) : null;
  if (!grid) return;
  if (count) count.textContent = items.length + "件";
  if (!items.length) {
    grid.innerHTML = '<div class="publicEmpty">表示できる更新がありません。</div>';
    return;
  }
  grid.innerHTML = items.map((item) => renderCard(item, mode)).join("");
  bindFollowButtons(grid);
}
function renderRecentGroups() {
  const grid = document.getElementById("recentGrid");
  if (!grid) return;
  const groups = DATA.recentGroups.map((group) => ({ ...group, items: filterItems(group.items) })).filter((group) => group.items.length);
  if (!groups.length) {
    grid.innerHTML = '<div class="publicEmpty">表示できる更新がありません。</div>';
    return;
  }
  grid.innerHTML = groups.map((group) =>
    '<div class="publicDateDivider"><span>' + escapeHtml(group.label) + '</span><span></span></div>' +
    group.items.map((item) => renderCard(item, "recent")).join("")
  ).join("");
  bindFollowButtons(grid);
}
function renderHiddenLine() {
  const node = document.getElementById("hiddenSection");
  if (!node) return;
  node.innerHTML = '<span>非表示 ' + escapeHtml(DATA.hiddenCount) + '件</span>' +
    '<span>PR ' + escapeHtml(DATA.hiddenBreakdown.promotion) + ' / 告知 ' + escapeHtml(DATA.hiddenBreakdown.announcement) + '</span>';
}
function renderMoreCard(total, remaining) {
  return '<button class="publicMoreCard" type="button" data-public-tab="discover" aria-label="発見一覧を開く">' +
    '発見一覧へ<span>さらに' + escapeHtml(remaining) + '件 / 全' + escapeHtml(total) + '件</span>' +
  '</button>';
}
function renderCard(item, mode) {
  const key = followKey(item);
  const followed = state.follows.has(key);
  const badges = buildBadges(item, mode);
  return '<article class="publicCard" style="--accent:' + escapeAttr(item.siteAccent) + '">' +
    '<a class="publicCardLink" href="' + escapeAttr(item.officialUrl) + '" target="_blank" rel="noreferrer" aria-label="' + escapeAttr(item.title) + 'を公式サイトで開く"></a>' +
    '<button class="publicFollowButton" type="button" data-follow="' + escapeAttr(key) + '" aria-pressed="' + followed + '" title="' + (followed ? "フォロー解除" : "フォロー") + '">' + (followed ? "✓" : "+") + '</button>' +
    '<div class="publicCardBody"><div class="publicWork"><span class="publicSiteMark" title="' + escapeAttr(item.siteName) + '">' + escapeHtml(item.siteMark) + '</span>' + escapeHtml(item.title || "無題") + '</div></div>' +
    (badges.length ? '<div class="publicBadgeRow">' + badges.map((badge) => '<span class="publicBadge">' + escapeHtml(badge) + '</span>').join("") + '</div>' : "") +
  '</article>';
}
function bindFollowButtons(root) {
  root.querySelectorAll("[data-follow]").forEach((button) => {
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
function buildBadges(item, mode) {
  const badges = [];
  if (mode === "discover" || mode === "followed") {
    const date = formatShortDate(item.publishedAt);
    if (date) badges.push(date);
  }
  return badges;
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
function readStringSet(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return new Set(Array.isArray(value) ? value : []);
  } catch {
    return new Set();
  }
}
function writeFollows() {
  localStorage.setItem(FOLLOW_KEY, JSON.stringify(Array.from(state.follows)));
}
function bindFollowBackupButtons() {
  document.getElementById("exportFollows")?.addEventListener("click", exportFollows);
  const importButton = document.getElementById("importFollows");
  const fileInput = document.getElementById("importFollowsFile");
  importButton?.addEventListener("click", () => fileInput?.click());
  fileInput?.addEventListener("change", async (event) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      await importFollows(file);
      alert("フォローを取り込みました。");
    } catch (error) {
      alert(error instanceof Error ? error.message : "フォローJSONを取り込めませんでした。");
    } finally {
      event.currentTarget.value = "";
    }
  });
}
function exportFollows() {
  const payload = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    origin: location.origin,
    follows: Array.from(state.follows).sort()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "allmanga-follows-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function importFollows(file) {
  const parsed = JSON.parse(await file.text());
  const follows = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.follows) ? parsed.follows : null;
  if (!follows) {
    throw new Error("フォローJSONの形式が違います。");
  }
  const next = follows.filter((value) => typeof value === "string" && value.includes("|"));
  if (follows.length > 0 && next.length === 0) {
    throw new Error("取り込めるフォローがありませんでした。");
  }
  state.follows = new Set(next);
  writeFollows();
  render();
}
function followKey(item) {
  return [item.siteId, item.title, item.officialUrl].join("|");
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
function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function escapeAttr(value) {
  return escapeHtml(value).replaceAll("\`", "&#96;");
}
`;
