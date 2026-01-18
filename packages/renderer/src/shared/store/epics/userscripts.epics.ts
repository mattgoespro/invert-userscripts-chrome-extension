import { combineEpics, Epic } from "redux-observable";
import { filter, tap, map } from "rxjs/operators";
import { Action } from "@reduxjs/toolkit";
import { updateUserscript, updateUserscriptCode } from "../slices/userscripts.slice";

/**
 * Epic that updates the userscript status to "saved" after a successful code update.
 *
 * Note: Storage-first pattern is now used for userscript CRUD operations.
 * The async thunks (addUserscript, deleteUserscript, toggleUserscript) handle
 * persistence to Chrome storage BEFORE updating Redux state, ensuring data consistency.
 */
const saveUserscriptEffect: Epic<Action> = (action$) =>
  action$.pipe(
    filter(updateUserscriptCode.fulfilled.match),
    tap(() => {
      console.log("Saved userscript after code update. Dispatching updateUserscript.");
    }),
    map(({ payload: { id } }) => updateUserscript(id, { status: "saved" }))
  );

export const userscriptsEpics = combineEpics(saveUserscriptEffect);
