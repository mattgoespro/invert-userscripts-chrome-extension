import { combineEpics, Epic } from "redux-observable";
import { filter, mergeMap, catchError, ignoreElements, tap, map } from "rxjs/operators";
import { from, EMPTY } from "rxjs";
import { StorageManager } from "@shared/storage";
import { Action } from "@reduxjs/toolkit";
import {
  addUserscript,
  updateUserscript,
  deleteUserscript,
  updateUserscriptCode,
} from "../slices/userscripts.slice";

const addUserscriptEffect: Epic<Action> = (action$) =>
  action$.pipe(
    filter(addUserscript.match),
    mergeMap((action) =>
      from(StorageManager.saveScript(action.payload)).pipe(
        tap(() => {
          console.log("Saved userscript.");
        }),
        ignoreElements(),
        catchError((error) => {
          console.error("Failed to save userscript:", error);
          return EMPTY;
        })
      )
    )
  );

const deleteUserscriptEffect: Epic<Action> = (action$) =>
  action$.pipe(
    filter(deleteUserscript.match),
    mergeMap((action) =>
      from(StorageManager.deleteScript(action.payload)).pipe(
        tap(() => {
          console.log("Deleted userscript.");
        }),
        ignoreElements(),
        catchError((error) => {
          console.error("Failed to delete userscript:", error);
          return EMPTY;
        })
      )
    )
  );

const saveUserscriptEffect: Epic<Action> = (action$) =>
  action$.pipe(
    filter(updateUserscriptCode.fulfilled.match),
    tap(() => {
      console.log("Saved userscript after code update. Dispatching updateUserscript.");
    }),
    map((action) => updateUserscript({ ...action.payload, status: "saved" }))
  );

export const userscriptsEpics = combineEpics(
  addUserscriptEffect,
  deleteUserscriptEffect,
  saveUserscriptEffect
);
