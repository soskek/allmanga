import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { ToastProvider } from "@/components/toast-provider";
import { WorkStackCard } from "@/components/work-stack-card";
import { ReleaseRow } from "@/components/release-row";
import { toPublicRelease } from "@/lib/queries/public";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn()
  }),
  usePathname: () => "/"
}));

describe("UI behavior", () => {
  it("renders major home actions for a work card", () => {
    render(
      <ToastProvider>
        <WorkStackCard
          card={{
            workId: "w1",
            title: "作品A",
            canonicalUrl: "https://example.com/a",
            openUrl: "https://example.com/a/1",
            siteId: "jumpplus",
            authors: ["作者"],
            pin: false,
            priority: 1,
            counts: {
              main_episode: 1,
              side_story: 1,
              illustration: 1,
              hiatus_illustration: 0,
              promotion: 1,
              announcement: 0,
              oneshot_discovery: 0,
              unknown: 0
            },
            unreadMainCount: 1
          }}
        />
      </ToastProvider>
    );

    expect(screen.getByLabelText("最新本編を既読")).toBeInTheDocument();
    expect(screen.getByLabelText("可視本編を全部既読")).toBeInTheDocument();
    expect(screen.getByLabelText("週末に回す")).toBeInTheDocument();
  });

  it("keeps public-safe payload metadata-only", () => {
    const result = toPublicRelease({
      id: "r1",
      title: "第1話",
      semanticKind: "main_episode",
      publishedAt: new Date("2026-04-14T10:00:00+09:00"),
      firstSeenAt: new Date("2026-04-14T10:00:00+09:00"),
      canonicalUrl: "https://example.com/episode/1",
      work: {
        id: "w1",
        siteId: "jumpplus",
        canonicalUrl: "https://example.com/work",
        title: "作品A",
        authors: '["作者"]',
        kind: "serial",
        status: "active",
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        descriptionText: "hidden"
      },
      site: {
        id: "jumpplus",
        name: "少年ジャンプ＋",
        enabled: true,
        baseUrl: "https://example.com",
        syncStrategy: "mixed",
        createdAt: new Date(),
        updatedAt: new Date()
      }
    } as never);

    expect(result).toMatchObject({
      workTitle: "作品A",
      siteName: "少年ジャンプ＋",
      officialUrl: "https://example.com/episode/1"
    });
    expect(result).not.toHaveProperty("descriptionText");
    expect(result).not.toHaveProperty("follow");
    expect(result).not.toHaveProperty("state");
  });

  it("shows a tiny date badge only when requested", () => {
    const item = {
      id: "r1",
      title: "読切A",
      canonicalUrl: "https://example.com/episode/1",
      semanticKind: "oneshot_discovery",
      publishedAt: new Date("2026-04-18T10:00:00+09:00"),
      firstSeenAt: new Date("2026-04-18T10:00:00+09:00"),
      siteId: "jumpplus",
      work: {
        title: "読切A",
        authors: JSON.stringify(["作者"])
      }
    };

    const { rerender } = render(
      <ToastProvider>
        <ReleaseRow item={item} timezone="Asia/Tokyo" showStateActions={false} hideImages showDateBadge />
      </ToastProvider>
    );

    expect(screen.getByText("4/18")).toBeInTheDocument();

    rerender(
      <ToastProvider>
        <ReleaseRow item={item} timezone="Asia/Tokyo" showStateActions={false} hideImages />
      </ToastProvider>
    );

    expect(screen.queryByText("4/18")).not.toBeInTheDocument();
  });

  it("does not show a fake date badge from firstSeenAt when publishedAt is missing", () => {
    render(
      <ToastProvider>
        <ReleaseRow
          item={{
            id: "r1",
            title: "発見A",
            canonicalUrl: "https://example.com/work/1",
            semanticKind: "oneshot_discovery",
            publishedAt: null,
            firstSeenAt: new Date("2026-04-18T10:00:00+09:00"),
            siteId: "jumpplus",
            work: {
              title: "発見A",
              authors: JSON.stringify(["作者"])
            }
          }}
          timezone="Asia/Tokyo"
          showStateActions={false}
          hideImages
          showDateBadge
        />
      </ToastProvider>
    );

    expect(screen.queryByText("4/18")).not.toBeInTheDocument();
    expect(screen.getByText("読切")).toBeInTheDocument();
  });
});
