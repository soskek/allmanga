import { redirect } from "next/navigation";
import { isGoogleAuthConfigured } from "@/lib/auth/google";
import { getSessionUser } from "@/lib/auth/session";
import { env } from "@/lib/env";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const session = await getSessionUser();
  if (session) {
    redirect("/");
  }
  const params = await searchParams;
  const googleEnabled = isGoogleAuthConfigured();
  const passwordEnabled = env.PASSWORD_LOGIN_ENABLED;
  const errorMessage = errorLabels[params?.error ?? ""];

  return (
    <main className="page-shell flex min-h-screen items-center justify-center">
      <div className="surface w-full max-w-md p-6">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.25em] text-ink/40">Private Dashboard</p>
          <h1 className="text-2xl font-semibold text-ink">AllManga Inbox</h1>
          <p className="text-sm text-ink/65">Google アカウントでログインします。許可されたアカウントだけが入れます。</p>
        </div>
        {errorMessage ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{errorMessage}</p>
        ) : null}

        <div className="mt-6 space-y-3">
          {googleEnabled ? (
            <a
              href="/api/auth/google/start"
              className="flex h-11 w-full items-center justify-center rounded-full bg-ink px-4 text-sm font-semibold text-white"
            >
              Google でログイン
            </a>
          ) : (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Google OAuth が未設定です。開発中は下のパスワードログインを使えます。</p>
          )}

          {passwordEnabled ? (
            <details className="rounded-xl border border-ink/10 bg-white/72 p-3">
              <summary className="cursor-pointer text-xs font-medium text-ink/60">開発・移行用パスワードログイン</summary>
              <form action="/api/auth/login" method="post" className="mt-3 space-y-3">
                <label className="block space-y-1 text-xs text-ink/70">
                  <span>パスワード</span>
                  <input name="password" type="password" required className="w-full rounded-xl border-ink/10 bg-white text-sm" />
                </label>
                <button className="w-full rounded-full bg-ink/88 px-4 py-2 text-xs font-semibold text-white">パスワードでログイン</button>
              </form>
            </details>
          ) : null}
        </div>
      </div>
    </main>
  );
}

const errorLabels: Record<string, string> = {
  google_not_configured: "Google OAuth がまだ設定されていません。",
  oauth_state: "ログイン状態の確認に失敗しました。もう一度試してください。",
  oauth_failed: "Google ログインに失敗しました。許可アカウントかどうかも確認してください。"
};
