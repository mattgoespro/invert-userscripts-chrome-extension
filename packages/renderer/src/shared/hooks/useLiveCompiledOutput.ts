import { useEffect, useRef, useState } from "react";

/** Each output lane owns seeding, debounce and acceptance of its latest build. */
export function useLiveCompiledOutput(
  scriptId: string,
  savedCode: string,
  isOpen: boolean,
  build: () => Promise<string>
): string {
  const [output, setOutput] = useState(savedCode);
  const selectedId = useRef(scriptId);
  useEffect(() => {
    if (selectedId.current !== scriptId || !isOpen) {
      setOutput(savedCode);
    }
    selectedId.current = scriptId;
  }, [scriptId, savedCode, isOpen]);

  useEffect(() => {
    if (!scriptId || !isOpen) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void build().then(
        (code) => {
          if (!cancelled) {
            setOutput(code);
          }
        },
        (error: unknown) => {
          if (!cancelled) {
            console.warn("Failed to build live output:", error);
            setOutput("");
          }
        }
      );
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [scriptId, isOpen, build]);
  return output;
}
