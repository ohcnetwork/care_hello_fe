import { useState } from "react";
import { Search } from "lucide-react";
import { useAppStore } from "@/hooks/useAppStore";
import AppCard from "@/components/AppCard";
import type { CareApp } from "@/types/appStore";

const ALL_CATEGORY = "all";

export default function AppStore() {
  const { data, isLoading, isError } = useAppStore();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);

  const filteredApps: CareApp[] = (data?.apps ?? []).filter((app) => {
    const matchesSearch =
      search.trim() === "" ||
      app.name.toLowerCase().includes(search.toLowerCase()) ||
      app.description.toLowerCase().includes(search.toLowerCase()) ||
      app.developer.name.toLowerCase().includes(search.toLowerCase()) ||
      (app.tags ?? []).some((t) =>
        t.toLowerCase().includes(search.toLowerCase()),
      );

    const matchesCategory =
      selectedCategory === ALL_CATEGORY || app.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const featuredApps = (data?.apps ?? []).filter((app) =>
    (data?.featured ?? []).includes(app.id),
  );

  const showFeatured =
    search.trim() === "" && selectedCategory === ALL_CATEGORY;

  const categories = [
    { id: ALL_CATEGORY, name: "All" },
    ...(data?.categories ?? []),
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">App Store</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Discover and install apps to extend CARE's capabilities.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search apps, developers, or tags…"
          className="w-full rounded-md border border-neutral-200 bg-white py-2 pl-9 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900"
        />
      </div>

      {/* Category Tabs */}
      <div className="mb-8 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              selectedCategory === cat.id
                ? "bg-neutral-900 text-white"
                : "border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400 hover:text-neutral-900"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="py-20 text-center text-sm text-neutral-400">
          Loading apps…
        </div>
      )}

      {isError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load the app store. Please try again later.
        </div>
      )}

      {/* Featured Apps */}
      {!isLoading && !isError && showFeatured && featuredApps.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-base font-semibold text-neutral-900">
            Featured
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredApps.map((app) => (
              <AppCard key={app.id} app={app} featured />
            ))}
          </div>
        </section>
      )}

      {/* All Apps */}
      {!isLoading && !isError && (
        <section>
          {showFeatured && (
            <h2 className="mb-4 text-base font-semibold text-neutral-900">
              All Apps
            </h2>
          )}
          {filteredApps.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredApps.map((app) => (
                <AppCard key={app.id} app={app} />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-sm text-neutral-400">
              No apps found{search ? ` for "${search}"` : ""}.
            </div>
          )}
        </section>
      )}

      {/* Publish CTA */}
      {!isLoading && !isError && (
        <div className="mt-12 rounded-lg border border-neutral-200 bg-neutral-50 p-6 text-center">
          <h3 className="text-sm font-semibold text-neutral-900">
            Want to publish your app?
          </h3>
          <p className="mt-1 text-sm text-neutral-500">
            Submit a pull request to the CARE App Store repository to list your
            app.
          </p>
          <a
            href="https://github.com/ohcnetwork/care_apps"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-900 underline underline-offset-4 hover:opacity-80"
          >
            View the App Store repository →
          </a>
        </div>
      )}
    </div>
  );
}
