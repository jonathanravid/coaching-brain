import { createFileRoute } from "@tanstack/react-router";
import { Desk } from "@/components/desk";
import { refreshDesk } from "@/lib/desk-refresh";

export const Route = createFileRoute("/")({
  loader: () => refreshDesk(),
  component: function Home() {
    const initial = Route.useLoaderData();
    return <Desk initial={initial} />;
  },
});
