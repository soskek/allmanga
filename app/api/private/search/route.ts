import { requireApiSession, ok } from "@/lib/api";
import { searchLibrary } from "@/lib/queries/private";

export async function GET(request: Request) {
  const unauthorized = await requireApiSession();
  if (unauthorized) {
    return unauthorized;
  }
  const query = new URL(request.url).searchParams.get("q") ?? "";
  return ok(await searchLibrary(query));
}
