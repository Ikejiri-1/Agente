import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import Landing from "./landing";

export default async function Home() {
  if (await getUser()) redirect("/painel");
  return <Landing />;
}
