import { ExternalLink, Github } from "lucide-react";
import type { CareApp } from "@/types/appStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";

interface AppCardProps {
  app: CareApp;
  featured?: boolean;
}

export default function AppCard({ app, featured = false }: AppCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md",
        featured && "border-neutral-900 ring-1 ring-neutral-900",
      )}
    >
      <div className="flex items-start gap-3">
        {app.icon ? (
          <img
            src={app.icon}
            alt={`${app.name} icon`}
            className="h-10 w-10 rounded-md object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-lg font-bold text-neutral-500">
            {app.name.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-neutral-900">
              {app.name}
            </h3>
            {featured && (
              <span className="shrink-0 rounded-full bg-neutral-900 px-2 py-0.5 text-xs font-medium text-white">
                Featured
              </span>
            )}
          </div>
          {app.version && (
            <p className="text-xs text-neutral-400">v{app.version}</p>
          )}
        </div>
      </div>

      <p className="mt-3 line-clamp-3 flex-1 text-sm text-neutral-600">
        {app.description}
      </p>

      {app.tags && app.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {app.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        {(app.developer.github ?? app.developer.url) ? (
          <a
            href={
              app.developer.github
                ? `https://github.com/${app.developer.github}`
                : app.developer.url
            }
            target="_blank"
            rel="noreferrer"
            className="text-xs text-neutral-500 hover:text-neutral-800 hover:underline"
          >
            {app.developer.name}
          </a>
        ) : (
          <span className="text-xs text-neutral-500">{app.developer.name}</span>
        )}

        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <a href={app.github} target="_blank" rel="noreferrer">
              <Github className="mr-1 h-3.5 w-3.5" />
              Source
            </a>
          </Button>
          {app.installUrl && (
            <Button asChild size="sm">
              <a href={app.installUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1 h-3.5 w-3.5" />
                Install
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
