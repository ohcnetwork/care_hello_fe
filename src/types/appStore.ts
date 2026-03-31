export interface AppDeveloper {
  name: string;
  github?: string;
  url?: string;
}

export interface AppCategory {
  id: string;
  name: string;
  description?: string;
}

export interface CareApp {
  id: string;
  name: string;
  description: string;
  category: string;
  developer: AppDeveloper;
  github: string;
  icon?: string;
  version?: string;
  tags?: string[];
  installUrl?: string;
}

export interface AppStoreManifest {
  featured: string[];
  categories: AppCategory[];
  apps: CareApp[];
}
