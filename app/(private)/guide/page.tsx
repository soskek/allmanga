import Link from "next/link";

export default function GuidePage() {
  return (
    <div className="space-y-3">
      <section className="surface space-y-2 p-2.5">
        <div className="space-y-0.5">
          <h1 className="text-[13px] font-semibold text-ink">使い方</h1>
          <p className="text-[10px] text-ink/56">
            このアプリは「全部を完璧に管理する」より、「追いたい作品の未読を見失わない」ための inbox です。
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          <Link href="/library" className="rounded-md bg-ink px-2 py-1 font-medium text-white">
            作品を追加する
          </Link>
          <Link href="/discover" className="rounded-md border border-ink/10 bg-white px-2 py-1 font-medium text-ink/75">
            新作と読切を見る
          </Link>
          <Link href="/settings" className="rounded-md border border-ink/10 bg-white px-2 py-1 font-medium text-ink/75">
            表示を調整する
          </Link>
        </div>
      </section>

      <section className="surface space-y-2 p-2.5">
        <h2 className="text-[12px] font-semibold text-ink">基本の考え方</h2>
        <div className="space-y-1.5 text-[11px] leading-5 text-ink/72">
          <p>
            `今日の更新` は広めの一覧です。フォローしていない作品も出ます。ここは「今日なにが更新されたか」をざっと見る場所です。
          </p>
          <p>
            `未読スタック` はホワイトリスト寄りです。自分で `フォロー` した作品だけが主役になります。追いたい作品はここに集める前提です。
          </p>
          <p>
            なので運用としては `ブラックリスト方式で全部を日々消す` より、`追いたい作品をフォローして stack を育てる` のが基本です。
          </p>
        </div>
      </section>

      <section className="surface space-y-2 p-2.5">
        <h2 className="text-[12px] font-semibold text-ink">最初にやること</h2>
        <ol className="space-y-1.5 text-[11px] leading-5 text-ink/72">
          <li>1. `ライブラリ` か `検索` で、追いたい作品を追加して `フォロー` します。</li>
          <li>2. 作品 URL を貼って追加してもいいし、タイトル検索でも大丈夫です。</li>
          <li>3. 以後は `ホーム` の `未読スタック` を見れば、追っている作品の未読本編が上に残ります。</li>
        </ol>
      </section>

      <section className="surface space-y-2 p-2.5">
        <h2 className="text-[12px] font-semibold text-ink">普段の見方</h2>
        <div className="space-y-1.5 text-[11px] leading-5 text-ink/72">
          <p>
            `未読スタック`:
            自分が追う作品の本編を読む場所です。ここがいちばん重要です。
          </p>
          <p>
            `今日の更新`:
            今日の更新を広く見る場所です。全部をここで整理しようとしなくて大丈夫です。
          </p>
          <p>
            `少し前の更新`:
            今日より前の更新を見返す場所です。見逃し確認用です。
          </p>
          <p>
            `発見`:
            新連載や読切をやんわり見る場所です。気になったら `フォロー` して stack に入れます。
          </p>
        </div>
      </section>

      <section className="surface space-y-2 p-2.5">
        <h2 className="text-[12px] font-semibold text-ink">ノイズを減らす方法</h2>
        <div className="space-y-1.5 text-[11px] leading-5 text-ink/72">
          <p>
            作品単位では `ミュート`、サイト単位では `設定` の `取り込みサイト` を切る、という 2 段で減らせます。
          </p>
          <p>
            番外編・イラスト・PR は `設定` の `ノイズの扱い` でたたむか隠せます。
          </p>
          <p>
            有料版だけの更新は、今は `今日の新着` の後ろ寄りで、グレーの網掛けと `有料` バッジを付けて弱く見せています。
          </p>
        </div>
      </section>

      <section className="surface space-y-2 p-2.5">
        <h2 className="text-[12px] font-semibold text-ink">迷ったときのおすすめ運用</h2>
        <div className="space-y-1.5 text-[11px] leading-5 text-ink/72">
          <p>1. まずは `ライブラリ` に本当に追いたい作品だけを入れる。</p>
          <p>2. 毎日は `未読スタック` だけ見る。</p>
          <p>3. 余裕がある日に `今日の新着` と `発見` を軽く眺める。</p>
          <p>4. 邪魔なサイトや作品が見えてきたら、あとから `ミュート` や site OFF を使う。</p>
        </div>
      </section>
    </div>
  );
}
