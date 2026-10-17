export const DOCUMENT_DATABASE = "invert-ide-documents";
export function openDocumentDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DOCUMENT_DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("repository");
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Close older IDE windows to upgrade document storage."));
  });
}
