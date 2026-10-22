import { isDriveRecord, type DriveRecord } from "@shared/storage/drive-sync";
import { sha256 } from "@shared/storage/sync/revision-codec";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const API = "https://www.googleapis.com/drive/v3";
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 64 * 1024 * 1024;
export class DriveAuthError extends Error {}
export interface DriveTransport {
  list(): Promise<string[]>;
  download(id: string): Promise<DriveRecord[]>;
  generateId(): Promise<string>;
  upload(id: string, records: DriveRecord[]): Promise<void>;
}
async function boundedBytes(
  stream: ReadableStream<Uint8Array>,
  limit: number
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      length += value.byteLength;
      if (length > limit) {
        throw new Error(
          "Drive sync file exceeds the supported size. Local data is unchanged."
        );
      }
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
export async function encodeDriveFile(
  records: DriveRecord[]
): Promise<Uint8Array> {
  const serialized = JSON.stringify(records);
  const envelope = JSON.stringify({
    format: "invert-drive-sync",
    version: 1,
    digest: await sha256(serialized),
    records,
  });
  if (new TextEncoder().encode(envelope).length > MAX_EXPANDED_BYTES) {
    throw new Error(
      "Drive upload is too large. Your changes are saved locally."
    );
  }
  return boundedBytes(
    new Blob([envelope]).stream().pipeThrough(new CompressionStream("gzip")),
    MAX_FILE_BYTES
  );
}
export async function decodeDriveFile(
  bytes: Uint8Array
): Promise<DriveRecord[]> {
  if (bytes.length > MAX_FILE_BYTES) {
    throw new Error("Drive sync file is too large.");
  }
  const expanded = await boundedBytes(
    new Blob([bytes as Uint8Array<ArrayBuffer>])
      .stream()
      .pipeThrough(new DecompressionStream("gzip")),
    MAX_EXPANDED_BYTES
  );
  const envelope = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(expanded)
  );
  if (
    !envelope ||
    envelope.format !== "invert-drive-sync" ||
    envelope.version !== 1 ||
    !Array.isArray(envelope.records) ||
    !envelope.records.every(isDriveRecord) ||
    typeof envelope.digest !== "string" ||
    (await sha256(JSON.stringify(envelope.records))) !== envelope.digest
  ) {
    throw new Error(
      "Invalid or damaged Drive sync file. Local data is unchanged."
    );
  }
  return envelope.records;
}
export class GoogleDriveTransport implements DriveTransport {
  constructor(
    private token: string,
    private signal: AbortSignal,
    private fetcher: typeof fetch = fetch,
    private invalidateToken: () => Promise<void> = async () => {}
  ) {}
  private async request(
    url: string,
    init: RequestInit = {}
  ): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", "Bearer " + this.token);
    const response = await this.fetcher.call(globalThis, url, {
      ...init,
      headers,
      signal: AbortSignal.any([this.signal, AbortSignal.timeout(20_000)]),
    });
    if (response.status === 401) {
      await this.invalidateToken();
      throw new DriveAuthError(
        "Reconnect your Google account to resume Drive sync."
      );
    }
    return response;
  }
  private ensure(response: Response): void {
    if (!response.ok) {
      throw new Error(
        `Google Drive request failed (${response.status}). Your changes remain saved locally.`
      );
    }
  }
  async account(): Promise<{ accountId: string; accountLabel: string }> {
    const response = await this.request(
      API + "/about?fields=user(permissionId,emailAddress)"
    );
    this.ensure(response);
    const data = await response.json();
    if (
      typeof data.user?.permissionId !== "string" ||
      !data.user.permissionId
    ) {
      throw new DriveAuthError(
        "Google account identity is unavailable. Reconnect to Drive."
      );
    }
    return {
      accountId: data.user.permissionId,
      accountLabel:
        typeof data.user.emailAddress === "string"
          ? data.user.emailAddress
          : "Google account",
    };
  }
  async list(): Promise<string[]> {
    const ids = new Set<string>();
    const tokens = new Set<string>();
    let pageToken: string | undefined;
    do {
      const query = new URLSearchParams({
        spaces: "appDataFolder",
        q: "trashed = false and appProperties has { key='invertSync' and value='1' }",
        fields: "nextPageToken,files(id)",
        pageSize: "1000",
      });
      if (pageToken) {
        query.set("pageToken", pageToken);
      }
      const response = await this.request(API + "/files?" + query);
      this.ensure(response);
      const data = await response.json();
      if (
        !Array.isArray(data.files) ||
        data.files.some(
          (file: { id?: unknown }) => !file || typeof file.id !== "string"
        )
      ) {
        throw new Error("Invalid Drive file listing.");
      }
      for (const file of data.files) {
        ids.add(file.id);
      }
      pageToken = data.nextPageToken;
      if (
        pageToken &&
        (typeof pageToken !== "string" || tokens.has(pageToken))
      ) {
        throw new Error("Invalid Drive pagination response.");
      }
      if (pageToken) {
        tokens.add(pageToken);
      }
    } while (pageToken);
    return [...ids];
  }
  async download(id: string): Promise<DriveRecord[]> {
    const response = await this.request(
      API + "/files/" + encodeURIComponent(id) + "?alt=media"
    );
    this.ensure(response);
    if (
      !response.body ||
      Number(response.headers.get("Content-Length")) > MAX_FILE_BYTES
    ) {
      throw new Error("Drive sync file is missing or too large.");
    }
    return decodeDriveFile(await boundedBytes(response.body, MAX_FILE_BYTES));
  }
  async generateId(): Promise<string> {
    const response = await this.request(
      API + "/files/generateIds?count=1&space=appDataFolder&type=files"
    );
    this.ensure(response);
    const data = await response.json();
    if (
      !Array.isArray(data.ids) ||
      typeof data.ids[0] !== "string" ||
      !data.ids[0]
    ) {
      throw new Error("Google Drive did not allocate an upload ID.");
    }
    return data.ids[0];
  }
  async upload(id: string, records: DriveRecord[]): Promise<void> {
    const bytes = await encodeDriveFile(records);
    const boundary = "invert_" + crypto.randomUUID();
    const metadata = {
      id,
      name: "invert-revisions-" + id + ".json.gz",
      mimeType: "application/gzip",
      parents: ["appDataFolder"],
      appProperties: { invertSync: "1" },
    };
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/gzip\r\n\r\n`,
      bytes as Uint8Array<ArrayBuffer>,
      `\r\n--${boundary}--\r\n`,
    ]);
    const response = await this.request(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
      {
        method: "POST",
        headers: { "Content-Type": "multipart/related; boundary=" + boundary },
        body,
      }
    );
    if (response.status === 409) {
      if (JSON.stringify(await this.download(id)) !== JSON.stringify(records)) {
        throw new Error(
          "Existing Drive upload has different content. Local changes have been retained."
        );
      }
      return;
    }
    this.ensure(response);
    const result = await response.json();
    if (result.id !== id) {
      throw new Error("Google Drive did not confirm the expected upload ID.");
    }
  }
}
export function driveConfigured(): boolean {
  return !!chrome.runtime.getManifest().oauth2?.client_id;
}
export async function authorizeDrive(
  interactive: boolean,
  signal: AbortSignal
): Promise<{
  accountId: string;
  accountLabel: string;
  transport: DriveTransport;
}> {
  let token: string | undefined;
  try {
    token = (
      await chrome.identity.getAuthToken({ interactive, scopes: [DRIVE_SCOPE] })
    ).token;
  } catch {
    throw new DriveAuthError(
      "Connect your Google account to enable persistent Drive sync."
    );
  }
  if (!token) {
    throw new DriveAuthError(
      "Connect your Google account to enable persistent Drive sync."
    );
  }
  const transport = new GoogleDriveTransport(token, signal, fetch, async () => {
    await chrome.identity.removeCachedAuthToken({ token });
  });
  return { ...(await transport.account()), transport };
}
