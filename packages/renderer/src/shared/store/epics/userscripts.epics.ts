import { combineEpics, Epic } from "redux-observable";
import { filter, mergeMap, catchError, ignoreElements, tap } from "rxjs/operators";
import { from, EMPTY } from "rxjs";
import { StorageManager } from "@shared/storage";
import { Action } from "@reduxjs/toolkit";
import { addUserscript, updateUserscript, deleteUserscript } from "../slices/userscripts.slice";

const addUserscriptEpic: Epic<Action> = (action$) =>
  action$.pipe(
    filter(addUserscript.match),
    mergeMap((action) =>
      from(StorageManager.createScript(action.payload)).pipe(
        tap(() => {
          console.log("Created new userscript.");
        }),
        ignoreElements(),
        catchError((error) => {
          console.error("Failed to create userscript:", error);
          return EMPTY;
        })
      )
    )
  );

const updateUserscriptEpic: Epic<Action> = (action$) =>
  action$.pipe(
    filter(updateUserscript.match),
    mergeMap((action) =>
      from(StorageManager.saveScript(action.payload)).pipe(
        tap(() => {
          console.log("Updated userscript.");
        }),
        ignoreElements(),
        catchError((error) => {
          console.error("Failed to update userscript:", error);
          return EMPTY;
        })
      )
    )
  );

const deleteUserscriptEpic: Epic<Action> = (action$) =>
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

export const userscriptsEpics = combineEpics(
  addUserscriptEpic,
  updateUserscriptEpic,
  deleteUserscriptEpic
);
