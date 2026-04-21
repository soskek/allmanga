import { ok } from "@/lib/api";
import { getPublicDiscover, toPublicRelease } from "@/lib/queries/public";

export async function GET() {
  const discover = await getPublicDiscover();
  return ok(discover.map((item: Awaited<ReturnType<typeof getPublicDiscover>>[number]) => toPublicRelease(item)));
}
