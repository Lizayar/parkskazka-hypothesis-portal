export type PublicMediaManifest = {
  version: 1;
  storagePolicy: "pages-and-github-releases";
  public: true;
  items: Array<{
    id: string;
    url: string;
    kind: "image" | "video" | "archive";
    sha256?: string;
    bytes?: number;
  }>;
};

export const PUBLIC_MEDIA_MANIFEST: PublicMediaManifest = {
  version: 1,
  storagePolicy: "pages-and-github-releases",
  public: true,
  items: [],
};

export function parsePublicMediaManifest(input: unknown): PublicMediaManifest {
  if (!input || typeof input !== "object") throw new Error("INVALID_MEDIA_MANIFEST");
  const value = input as Record<string, unknown>;
  if (value.version !== 1 || value.storagePolicy !== "pages-and-github-releases" || value.public !== true) {
    throw new Error("INVALID_MEDIA_MANIFEST");
  }
  if (!Array.isArray(value.items) || value.items.length > 500) throw new Error("INVALID_MEDIA_MANIFEST");
  const items = value.items.map((item) => {
    if (!item || typeof item !== "object") throw new Error("INVALID_MEDIA_MANIFEST");
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || !/^[a-z0-9][a-z0-9_-]{0,127}$/i.test(row.id)) throw new Error("INVALID_MEDIA_MANIFEST");
    if (typeof row.url !== "string") throw new Error("INVALID_MEDIA_MANIFEST");
    const url = new URL(row.url);
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname.endsWith("github.com")) {
      throw new Error("INVALID_MEDIA_MANIFEST");
    }
    if (row.kind !== "image" && row.kind !== "video" && row.kind !== "archive") throw new Error("INVALID_MEDIA_MANIFEST");
    if (row.sha256 !== undefined && (typeof row.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(row.sha256))) throw new Error("INVALID_MEDIA_MANIFEST");
    if (row.bytes !== undefined && (typeof row.bytes !== "number" || !Number.isSafeInteger(row.bytes) || row.bytes < 0)) throw new Error("INVALID_MEDIA_MANIFEST");
    return { id: row.id, url: row.url, kind: row.kind, ...(row.sha256 ? { sha256: row.sha256 } : {}), ...(row.bytes !== undefined ? { bytes: row.bytes } : {}) } as PublicMediaManifest["items"][number];
  });
  return { version: 1, storagePolicy: "pages-and-github-releases", public: true, items };
}

