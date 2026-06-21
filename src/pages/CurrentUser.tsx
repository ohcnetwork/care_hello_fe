import { useQuery } from "@tanstack/react-query";
import { HttpMethod, Type, apiRoutes, query } from "@/lib/requests";

// Typed route object — mirrors the host's src/types/*Api.ts pattern.
const routes = apiRoutes({
  getCurrentUser: {
    path: "/api/v1/users/getcurrentuser/",
    method: HttpMethod.GET,
    TRes: Type<{ username: string; first_name?: string; last_name?: string }>(),
  },
});

export default function CurrentUser() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["care_hello_fe", "current-user"],
    queryFn: query(routes.getCurrentUser, { silent: true }),
  });

  if (isLoading) return <p>Loading current user…</p>;
  if (error) return <p>Not signed in (or API unavailable).</p>;
  return <p>Hello, {data?.first_name ?? data?.username} 👋</p>;
}
