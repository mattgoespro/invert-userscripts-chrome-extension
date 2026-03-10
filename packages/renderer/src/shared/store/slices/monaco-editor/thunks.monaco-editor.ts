import { registerMonaco } from "@packages/monaco";
import { createAsyncThunk } from "@reduxjs/toolkit/react";
import { updateUserscriptCode } from "../userscripts/thunks.userscripts";
import { PrettierFormatter } from "@/sandbox/formatter";
import { UserscriptSourceLanguage } from "@shared/model";

export const initializeMonaco = createAsyncThunk(
  "editor/initializeMonaco",
  async () => {
    await registerMonaco();
  }
);

export const saveEditorCode = createAsyncThunk(
  "editor/saveEditorCode",
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

    return { code: formattedCode };
  }
);
