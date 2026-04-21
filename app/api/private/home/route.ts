import { requireApiSession, ok } from "@/lib/api";
import { getHomeView } from "@/lib/queries/private";

export async function GET() {
  const unauthorized = await requireApiSession();
  if (unauthorized) {
    return unauthorized;
  }
  return ok(await getHomeView());
}
