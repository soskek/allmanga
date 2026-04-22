import { PublicHome } from "@/components/public-home";
import { getPublicHomeView } from "@/lib/queries/public-home";

export const dynamic = "force-dynamic";

export default async function PublicPage() {
  return <PublicHome data={await getPublicHomeView()} />;
}
