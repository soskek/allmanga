import { requireApiSession } from "@/lib/api";
import { exportUserData } from "@/lib/actions";

export async function GET() {
  const unauthorized = await requireApiSession();
  if (unauthorized) {
    return unauthorized;
  }
  const data = await exportUserData();
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json"
    }
  });
}
