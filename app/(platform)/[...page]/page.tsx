import { requireUser } from "@/server/auth";
import { notFound } from "next/navigation";
import Platform from "@/components/Platform";
export default async function Page({
  params,
}: {
  params: Promise<{ page: string[] }>;
}) {
  await requireUser();
  const route = (await params).page.join("/");
  if (
    ![
      "dashboard",
      "portfolio",
      "scenarios",
      "scenarios/new",
      "history",
      "settings",
    ].includes(route) &&
    !/^scenarios\/[a-z0-9]+$/.test(route)
  )
    notFound();
  return <Platform route={route} />;
}
