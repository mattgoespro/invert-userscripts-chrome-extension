import { combineEpics, Epic } from "redux-observable";
import { filter, mergeMap, catchError, ignoreElements } from "rxjs/operators";
import { from, EMPTY } from "rxjs";
import { StorageManager } from "@shared/storage";
import { Action } from "@reduxjs/toolkit";
import { addUserscript, updateUserscript, deleteUserscript } from "../slices/userscripts.slice";

const addUserscriptEpic: Epic<Action> = (action$) =>
  action$.pipe(
    filter(addUserscript.match),
    mergeMap((action) =>
      from(StorageManager.saveScript(action.payload)).pipe(
        // Side effect done.
        // In a real app, you might dispatch a notification or 'saveSuccess' action here.
        ignoreElements(),
        catchError((error) => {
          console.error("Failed to save script:", error);
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
        ignoreElements(),
        catchError((error) => {
          console.error("Failed to update script:", error);
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
        ignoreElements(),
        catchError((error) => {
          console.error("Failed to delete script:", error);
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
