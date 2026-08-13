import type { AdapterPage } from "@portal/adapters/contracts";

export function serializePages(pages: readonly AdapterPage[]): string {
  return JSON.stringify(
    pages.map((page) => ({
      page: page.page,
      hasNextPage: page.hasNextPage,
      rows: page.rows,
    })),
  );
}

