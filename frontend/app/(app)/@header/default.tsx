import { me } from "@/app/actions";
import Header from "@/components/Header";

export default async function DefaultAppHeader() {
  const user = await me();

  return <Header user={user} />;
}
