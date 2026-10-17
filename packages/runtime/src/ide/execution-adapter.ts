export interface ExecutionRequest {
  tabId: number;
  documentId?: string;
  code: string;
  awaitCompletion?: boolean;
  injectImmediately?: boolean;
}
export interface ExecutionAdapter {
  execute(request: ExecutionRequest): Promise<void>;
}
