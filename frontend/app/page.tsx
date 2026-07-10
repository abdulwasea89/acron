import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/session";

export default async function Home() {
  redirect((await isAuthenticated()) ? "/app" : "/login");
}
