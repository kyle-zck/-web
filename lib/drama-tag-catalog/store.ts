import { promises as fs } from "fs";
import path from "path";
import { shouldUsePgStorage } from "@/lib/app-config/service";
import type { CatalogItem } from "./storage-pg";
import * as pgStore from "./storage-pg";

const DATA_PATH = path.join(process.cwd(), "data", "drama-tag-catalog.json");

async function readFileCatalog(): Promise<{ items: CatalogItem[] }> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    const data = JSON.parse(raw) as { items?: CatalogItem[] };
    return { items: Array.isArray(data.items) ? data.items : [] };
  } catch {
    return { items: [] };
  }
}

async function writeFileCatalog(data: { items: CatalogItem[] }): Promise<void> {
  const dir = path.dirname(DATA_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export async function readCatalog(): Promise<{ items: CatalogItem[] }> {
  if (shouldUsePgStorage()) {
    try {
      const fromPg = await pgStore.readItemsFromPg();
      if (fromPg !== undefined) {
        return { items: fromPg };
      }
      const fromFile = await readFileCatalog();
      if (fromFile.items.length > 0) {
        await pgStore.writeItemsToPg(fromFile.items);
      }
      return fromFile;
    } catch (e) {
      console.error("[drama-tag-catalog] read pg failed, fallback file:", e);
      return readFileCatalog();
    }
  }
  return readFileCatalog();
}

export async function writeCatalog(data: { items: CatalogItem[] }): Promise<void> {
  if (shouldUsePgStorage()) {
    try {
      await pgStore.writeItemsToPg(data.items);
      return;
    } catch (e) {
      console.error("[drama-tag-catalog] write pg failed, fallback file:", e);
    }
  }
  await writeFileCatalog(data);
}
