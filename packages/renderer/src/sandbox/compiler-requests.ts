import type { UserscriptCompileResult } from "@shared/model";

export interface CompilerEvents {
  ready(): void;
  result(id: string, result: UserscriptCompileResult): void;
  failed(error: Error): void;
}

export interface CompilerTransport<Input> {
  send(id: string, input: Input): void;
  close(): void;
}

interface CompilerRequestOptions<Input> {
  connect(events: CompilerEvents): CompilerTransport<Input>;
  initializationTimeoutMs: number;
  requestTimeoutMs: number;
  initializationTimeoutError: string;
  initializationFailureError: string;
  requestTimeoutError: string;
  unavailableError: string;
  clock?: Pick<typeof globalThis, "setTimeout" | "clearTimeout">;
}

interface PendingRequest {
  resolve(result: UserscriptCompileResult): void;
  timer: ReturnType<typeof setTimeout>;
}

interface CompilerGeneration<Input> {
  ready: boolean;
  promise: Promise<void>;
  resolve(): void;
  reject(error: Error): void;
  transport?: CompilerTransport<Input>;
  timer?: ReturnType<typeof setTimeout>;
  pending: Map<string, PendingRequest>;
}

/** Shared bookkeeping; native transports retain their protocols and failures. */
export function createCompilerRequests<Input>(
  options: CompilerRequestOptions<Input>
): {
  initialize(): Promise<void>;
  request(input: Input): Promise<UserscriptCompileResult>;
} {
  const clock = options.clock ?? globalThis;
  let current: CompilerGeneration<Input> | undefined;
  const asError = (error: unknown): Error =>
    error instanceof Error
      ? error
      : new Error(options.initializationFailureError);

  const fail = (generation: CompilerGeneration<Input>, error: Error): void => {
    if (current !== generation) {
      return;
    }
    current = undefined;
    clock.clearTimeout(generation.timer);
    generation.transport?.close();
    if (!generation.ready) {
      generation.reject(error);
    }
    for (const pending of generation.pending.values()) {
      clock.clearTimeout(pending.timer);
      pending.resolve({ success: false, error });
    }
    generation.pending.clear();
  };

  const initialize = (): Promise<void> => {
    if (current) {
      return current.promise;
    }
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    const generation: CompilerGeneration<Input> = {
      ready: false,
      promise,
      resolve,
      reject,
      pending: new Map(),
    };
    // Publish before construction: synchronous construction failure must leave
    // the next initialization free to retry, rather than cache a rejection.
    current = generation;
    generation.timer = clock.setTimeout(() => {
      fail(generation, new Error(options.initializationTimeoutError));
    }, options.initializationTimeoutMs);
    try {
      const transport = options.connect({
        ready: () => {
          if (current !== generation || generation.ready) {
            return;
          }
          clock.clearTimeout(generation.timer);
          generation.ready = true;
          generation.resolve();
        },
        result: (id, result) => {
          if (current !== generation) {
            return;
          }
          const pending = generation.pending.get(id);
          if (!pending) {
            return;
          }
          generation.pending.delete(id);
          clock.clearTimeout(pending.timer);
          pending.resolve(result);
        },
        failed: (error) => fail(generation, error),
      });
      if (current === generation) {
        generation.transport = transport;
      } else {
        transport.close();
      }
    } catch (error) {
      fail(generation, asError(error));
    }
    return promise;
  };

  const request = async (input: Input): Promise<UserscriptCompileResult> => {
    let generation: CompilerGeneration<Input>;
    try {
      const ready = initialize();
      generation = current;
      await ready;
    } catch (error) {
      return { success: false, error: asError(error) };
    }
    if (current !== generation || !generation?.transport) {
      return { success: false, error: new Error(options.unavailableError) };
    }
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const timer = clock.setTimeout(() => {
        if (generation.pending.delete(id)) {
          resolve({
            success: false,
            error: new Error(options.requestTimeoutError),
          });
        }
      }, options.requestTimeoutMs);
      generation.pending.set(id, { resolve, timer });
      try {
        generation.transport.send(id, input);
      } catch (error) {
        // Preserve send exceptions as promise rejections, while releasing the
        // request and its timer immediately.
        generation.pending.delete(id);
        clock.clearTimeout(timer);
        reject(error);
      }
    });
  };
  return { initialize, request };
}
