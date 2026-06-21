/**
 * Vendored request layer for CARE plugins. Mirrors the API of care_fe
 * `src/Utils/request/{query,mutate}.ts` but is standalone: it reads the backend base
 * URL from `window.CARE_API_URL` and the JWT from localStorage. Plugins must NOT import
 * the host's request utils (they aren't federation-shared) — vendor this instead.
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type QueryParamValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number | boolean | null | undefined>;

export type QueryParams = Record<string, QueryParamValue>;

export enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  PATCH = "PATCH",
  DELETE = "DELETE",
}

export interface ApiRoute<TData, TBody = unknown> {
  baseUrl?: string;
  method?: HttpMethod;
  path: string;
  TBody?: TBody;
  TRes: TData;
  noAuth?: boolean;
  defaultQueryParams?: QueryParams;
}

export const apiRoutes = <
  const T extends Record<string, ApiRoute<unknown, unknown>>,
>(
  routes: T,
): T => routes;

type ExtractRouteParams<T extends string> =
  T extends `${infer _Start}{${infer Param}}${infer Rest}`
    ? Param | ExtractRouteParams<Rest>
    : never;

type PathParams<T extends string> = { [_ in ExtractRouteParams<T>]: string };

interface ApiCallOptions<Route extends ApiRoute<unknown, unknown>> {
  pathParams?: PathParams<Route["path"]>;
  queryParams?: QueryParams;
  body?: Route["TBody"];
  silent?: boolean | ((response: Response) => boolean);
  signal?: AbortSignal;
  headers?: HeadersInit;
  baseUrl?: string;
}

export class HttpError extends Error {
  status: number;
  silent: boolean;
  cause?: Record<string, unknown>;
  constructor(args: {
    message: string;
    status: number;
    silent: boolean;
    cause?: Record<string, unknown>;
  }) {
    super(args.message);
    this.status = args.status;
    this.silent = args.silent;
    this.cause = args.cause;
  }
}

export interface PaginatedResponse<TItem> {
  count: number;
  results: TItem[];
}

/** Phantom type helper — captures TS types for a route without runtime cost. */
export function Type<T>(): T {
  return {} as T;
}

const getQueryParams = (query: QueryParams) => {
  const qp = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value == undefined) return;
    if (Array.isArray(value)) {
      value.forEach((v) => qp.append(key, `${v}`));
      return;
    }
    qp.set(key, `${value}`);
  });
  return qp.toString();
};

const getUrl = (
  path: string,
  query?: QueryParams,
  pathParams?: Record<string, string | number>,
  baseUrl?: string,
) => {
  if (pathParams) {
    path = Object.entries(pathParams).reduce(
      (acc, [key, value]) => acc.replace(`{${key}}`, `${value}`),
      path,
    );
  }
  const url = new URL(path, baseUrl || window.CARE_API_URL);
  if (query) url.search = getQueryParams(query);
  return url.toString();
};

function getHeaders(noAuth?: boolean, additional?: HeadersInit) {
  const headers = new Headers(additional);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  if (!noAuth) {
    const token = localStorage.getItem("care_access_token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

async function getResponseBody<TData>(res: Response): Promise<TData> {
  if (res.headers.get("content-length") === "0") return null as TData;
  const isJson = res.headers.get("content-type")?.includes("application/json");
  if (!isJson) return (await res.text()) as TData;
  try {
    return await res.json();
  } catch {
    return (await res.text()) as TData;
  }
}

async function request<Route extends ApiRoute<unknown, unknown>>(
  { path, method, noAuth }: Route,
  options?: ApiCallOptions<Route>,
): Promise<Route["TRes"]> {
  const url = getUrl(
    path,
    options?.queryParams,
    options?.pathParams,
    options?.baseUrl,
  );
  const fetchOptions: RequestInit = {
    method: method ?? HttpMethod.GET,
    headers: getHeaders(noAuth, options?.headers),
    signal: options?.signal,
  };
  if (options?.body) fetchOptions.body = JSON.stringify(options.body);

  let res: Response;
  try {
    res = await fetch(url, fetchOptions);
  } catch {
    throw new Error("Network Error");
  }
  const data = await getResponseBody<Route["TRes"]>(res);
  if (!res.ok) {
    const isSilent =
      typeof options?.silent === "function"
        ? options.silent(res)
        : (options?.silent ?? false);
    throw new HttpError({
      message: "Request Failed",
      status: res.status,
      silent: isSilent,
      cause: data as unknown as Record<string, unknown>,
    });
  }
  return data;
}

const query = <Route extends ApiRoute<unknown, unknown>>(
  route: Route,
  options?: ApiCallOptions<Route>,
) => {
  return ({ signal }: { signal: AbortSignal }) =>
    request(route, { ...options, signal });
};

const debouncedQuery = <Route extends ApiRoute<unknown, unknown>>(
  route: Route,
  options?: ApiCallOptions<Route> & { debounceInterval?: number },
) => {
  return async ({ signal }: { signal: AbortSignal }) => {
    await sleep(options?.debounceInterval ?? 500);
    return query(route, { ...options })({ signal });
  };
};
query.debounced = debouncedQuery;

const mutate = <Route extends ApiRoute<unknown, unknown>>(
  route: Route,
  options?: ApiCallOptions<Route>,
) => {
  return (variables: Route["TBody"]) =>
    request(route, { ...options, body: variables });
};

export { request, query, mutate };
