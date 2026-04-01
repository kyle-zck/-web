const DB_NAME = "bg-upload-db";
const DB_VERSION = 1;
const STORE_NAME = "upload-sessions";
const FILE_CHUNKS_STORE = "file-chunks";

let dbInstance: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      dbInstance = req.result;
      resolve(dbInstance);
    };

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(FILE_CHUNKS_STORE)) {
        db.createObjectStore(FILE_CHUNKS_STORE, { keyPath: "id", autoIncrement: true });
      }

      if (!db.objectStoreNames.contains(FILE_DATA_STORE)) {
        db.createObjectStore(FILE_DATA_STORE, { keyPath: ["sessionId", "fileIndex"] });
      }
    };
  });
}

export interface UploadSession {
  id: string;
  formData: {
    title: string;
    originalName: string;
    localOrTranslated: string;
    totalEpisodes: number;
    description: string;
    tagIds: string[];
    lockStartIndex: number;
    coverUrl: string;
    uploadVideoMode: "mp4" | "hls";
    listed: boolean;
  };
  files: Array<{
    fileName: string;
    fileSize: number;
    fileType: string;
    index: number;
    stage: string;
    percent: number;
    uploadUrl?: string;
    publicUrl?: string;
    key?: string;
    retryCount: number;
  }>;
  status: "pending" | "uploading" | "paused" | "completed" | "failed";
  currentIndex: number;
  createdAt: number;
  updatedAt: number;
  serverSeriesId?: string;
}

export interface StoredFileChunk {
  id?: number;
  sessionId: string;
  fileIndex: number;
  chunk: Blob;
  chunkIndex: number;
}

export interface UploadFileData {
  sessionId: string;
  fileIndex: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  data: Blob;
}

const FILE_DATA_STORE = "file-data";

export async function saveUploadSession(session: UploadSession): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    session.updatedAt = Date.now();
    const req = store.put(session);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

export async function saveFileData(fileData: UploadFileData): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_DATA_STORE, "readwrite");
    const store = tx.objectStore(FILE_DATA_STORE);
    const req = store.put(fileData);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

export async function getFileData(sessionId: string, fileIndex: number): Promise<UploadFileData | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_DATA_STORE, "readonly");
    const store = tx.objectStore(FILE_DATA_STORE);
    const req = store.getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const result = req.result.find(
        (item: UploadFileData) => item.sessionId === sessionId && item.fileIndex === fileIndex
      );
      resolve(result);
    };
  });
}

export async function getAllFileData(sessionId: string): Promise<UploadFileData[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_DATA_STORE, "readonly");
    const store = tx.objectStore(FILE_DATA_STORE);
    const req = store.getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const result = req.result.filter((item: UploadFileData) => item.sessionId === sessionId);
      resolve(result ?? []);
    };
  });
}

export async function deleteFileData(sessionId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_DATA_STORE, "readwrite");
    const store = tx.objectStore(FILE_DATA_STORE);
    const req = store.getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const toDelete = req.result.filter((item: UploadFileData) => item.sessionId === sessionId);
      toDelete.forEach((item: UploadFileData) => store.delete([item.sessionId, item.fileIndex]));
      resolve();
    };
  });
}

export async function getUploadSession(id: string): Promise<UploadSession | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

export async function getAllUploadSessions(): Promise<UploadSession[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result ?? []);
  });
}

export async function deleteUploadSession(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

export async function updateSessionFileProgress(
  sessionId: string,
  fileIndex: number,
  patch: Partial<UploadSession["files"][number]>
): Promise<void> {
  const session = await getUploadSession(sessionId);
  if (!session) return;

  const fileIdx = session.files.findIndex((f) => f.index === fileIndex);
  if (fileIdx >= 0) {
    session.files[fileIdx] = { ...session.files[fileIdx], ...patch };
    await saveUploadSession(session);
  }
}

export async function clearAllSessions(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

export async function getActiveSessionsCount(): Promise<number> {
  const sessions = await getAllUploadSessions();
  return sessions.filter((s) => s.status === "pending" || s.status === "uploading").length;
}

export async function isBackgroundUploadSupported(): Promise<boolean> {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in window.navigator &&
    "indexedDB" in window &&
    "PushManager" in window
  );
}

export function generateSessionId(): string {
  return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
