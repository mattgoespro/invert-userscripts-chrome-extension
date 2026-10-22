import {
  isDriveLayout,
  resolveDrivePreference,
  setDriveLayout,
} from "@shared/storage/drive-sync";
import type { RepositoryRequest } from "@shared/publication/client";
import type { DriveRepository, DriveSyncService } from "./service";

let runtime:
  | {
      service: DriveSyncService;
      repository: DriveRepository;
      prepare: () => Promise<void>;
      notify: () => void;
    }
  | undefined;
export function installDriveRuntime(value: NonNullable<typeof runtime>): void {
  runtime = value;
}
export function scheduleDriveSync(): void {
  runtime?.service.schedule();
}
export async function handleDriveRequest(
  request: RepositoryRequest
): Promise<unknown> {
  if (!runtime) {
    throw new Error("Drive sync is not available in this context.");
  }
  const { service, repository, prepare, notify } = runtime;
  switch (request.type) {
    case "publication.drive.status":
      return service.status();
    case "publication.drive.connect":
      await service.run(true);
      return service.status();
    case "publication.drive.disconnect":
      await service.disconnect();
      return service.status();
    case "publication.drive.sync":
      await service.run();
      return service.status();
    case "publication.drive.download":
      await service.run(false, true);
      return service.status();
    case "publication.drive.layout.read":
      return { layout: (await repository.state()).drive?.layout ?? null };
    case "publication.drive.layout.write": {
      if (!isDriveLayout(request.value)) {
        throw new Error("Invalid UI layout.");
      }
      await prepare();
      const changed = await repository.update((state) => ({
        state,
        value: setDriveLayout(state, request.value),
      }));
      if (changed) {
        service.schedule();
      }
      return { status: "saved" };
    }
    case "publication.drive.resolve":
      if (
        !["settings", "modules", "layout"].includes(request.kind) ||
        typeof request.revision !== "string" ||
        !Number.isSafeInteger(request.generation)
      ) {
        throw new Error("Invalid Drive conflict resolution.");
      }
      await repository.update((state) => {
        resolveDrivePreference(
          state,
          request.kind,
          request.revision,
          request.generation
        );
        return { state, value: undefined };
      });
      notify();
      service.schedule();
      return { status: "resolved" };
    default:
      throw new Error("Invalid Drive command.");
  }
}
