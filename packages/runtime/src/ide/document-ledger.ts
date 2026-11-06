const SESSION_KEY = "injectDocumentLedger";
/** Keeps documents the back/forward cache can restore without unbounded growth. */
const MAX_DOCUMENTS_PER_TAB = 16;

interface DocumentEntry {
  tabId: number;
  steps: string[];
}
type DocumentLedger = Record<string, DocumentEntry>;

let mutations: Promise<unknown> = Promise.resolve();

async function readLedger(): Promise<DocumentLedger> {
  const result = await chrome.storage.session.get(SESSION_KEY);
  return (result[SESSION_KEY] as DocumentLedger | undefined) ?? {};
}

function mutateLedger<T>(change: (ledger: DocumentLedger) => T): Promise<T> {
  const task = mutations.then(async () => {
    const ledger = await readLedger();
    const value = change(ledger);
    await chrome.storage.session.set({ [SESSION_KEY]: ledger });
    return value;
  });
  mutations = task.catch(() => {});
  return task;
}

/** Document-lifetime execution facts; document IDs die with the browser session. */
export async function hasDocumentStep(
  documentId: string,
  step: string
): Promise<boolean> {
  await mutations;
  const ledger = await readLedger();
  return ledger[documentId]?.steps.includes(step) ?? false;
}

/** Returns false when the document already recorded this step. */
export function recordDocumentStep(
  tabId: number,
  documentId: string,
  step: string
): Promise<boolean> {
  return mutateLedger((ledger) => {
    const entry = (ledger[documentId] ??= { tabId, steps: [] });
    if (entry.steps.includes(step)) {
      return false;
    }
    entry.steps.push(step);
    const documents = Object.keys(ledger).filter(
      (id) => ledger[id].tabId === tabId
    );
    for (const id of documents.slice(0, -MAX_DOCUMENTS_PER_TAB)) {
      delete ledger[id];
    }
    return true;
  });
}

export function forgetTabDocuments(tabId: number): Promise<void> {
  return mutateLedger((ledger) => {
    for (const id of Object.keys(ledger)) {
      if (ledger[id].tabId === tabId) {
        delete ledger[id];
      }
    }
  });
}
