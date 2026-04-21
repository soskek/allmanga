import { ok } from "@/lib/api";
import { getPublicRecent, toPublicRelease } from "@/lib/queries/public";

export async function GET() {
  const recent = await getPublicRecent();
  return ok(recent.map((item: Awaited<ReturnType<typeof getPublicRecent>>[number]) => toPublicRelease(item)));
}
