import { currentUser } from "@/server/auth";
import { redirect } from "next/navigation";
import Login from "@/components/Login";
export default async function Page() {
  if (await currentUser()) redirect("/dashboard");
  return <Login />;
}
