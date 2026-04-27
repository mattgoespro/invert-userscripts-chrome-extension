import { registerMonaco } from "@packages/monaco";
import { createAsyncThunk } from "@reduxjs/toolkit/react";
import { updateUserscriptCode } from "../userscripts/thunks.userscripts";
import { PrettierFormatter } from "@/sandbox/formatter";
import { UserscriptSourceLanguage } from "@shared/model";
import type { RuntimePortMessageEvent } from "@shared/messages";

export const initializeMonaco = createAsyncThunk(
  "code-editor/initializeMonaco",
  async () => {
    await registerMonaco();
  }
);

export const saveEditorCode = createAsyncThunk(
  "code-editor/saveEditorCode",
  async (
    {
      scriptId,
      language,
      code,
      autoFormat,
    }: {
      scriptId: string;
      language: UserscriptSourceLanguage;
      code: string;
      autoFormat: boolean;
    },
    { dispatch }
  ) => {
    let formattedCode = code;

    if (autoFormat) {
      formattedCode = await PrettierFormatter.format(code, language);
    }

    await dispatch(
      updateUserscriptCode({ id: scriptId, language, code: formattedCode })
    ).unwrap();

    const message: RuntimePortMessageEvent<"refreshTabs"> = {
      source: "options",
      type: "refreshTabs",
    };

    chrome.runtime
      .sendMessage(message)
      .catch((error) => {
        console.warn("Failed to send refreshTabs message:", error);
      });

    return { code: formattedCode };
  }
);
