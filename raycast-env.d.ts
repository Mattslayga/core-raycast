/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Core Edge Base URL - Base URL for the Core Edge server. */
  "baseUrl": string,
  /** Core Edge API Token - Core Edge bearer token used for read-only API calls. */
  "apiToken": string,
  /** Namespace - Optional namespace override. Leave blank to use the token default. */
  "namespace"?: string,
  /** Result Limit - Maximum number of search results to show. */
  "resultLimit": "5" | "10" | "20"
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `search-core` command */
  export type SearchCore = ExtensionPreferences & {}
  /** Preferences accessible in the `explore-core` command */
  export type ExploreCore = ExtensionPreferences & {}
  /** Preferences accessible in the `quick-capture` command */
  export type QuickCapture = ExtensionPreferences & {}
  /** Preferences accessible in the `link-records` command */
  export type LinkRecords = ExtensionPreferences & {}
  /** Preferences accessible in the `what-next` command */
  export type WhatNext = ExtensionPreferences & {}
  /** Preferences accessible in the `open-loops` command */
  export type OpenLoops = ExtensionPreferences & {}
  /** Preferences accessible in the `agenda` command */
  export type Agenda = ExtensionPreferences & {}
  /** Preferences accessible in the `recent` command */
  export type Recent = ExtensionPreferences & {}
  /** Preferences accessible in the `project-context` command */
  export type ProjectContext = ExtensionPreferences & {}
  /** Preferences accessible in the `browse-records` command */
  export type BrowseRecords = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `search-core` command */
  export type SearchCore = {}
  /** Arguments passed to the `explore-core` command */
  export type ExploreCore = {}
  /** Arguments passed to the `quick-capture` command */
  export type QuickCapture = {}
  /** Arguments passed to the `link-records` command */
  export type LinkRecords = {}
  /** Arguments passed to the `what-next` command */
  export type WhatNext = {}
  /** Arguments passed to the `open-loops` command */
  export type OpenLoops = {}
  /** Arguments passed to the `agenda` command */
  export type Agenda = {}
  /** Arguments passed to the `recent` command */
  export type Recent = {}
  /** Arguments passed to the `project-context` command */
  export type ProjectContext = {}
  /** Arguments passed to the `browse-records` command */
  export type BrowseRecords = {}
}

