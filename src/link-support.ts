import {
  CoreRecordType,
  CoreRecordRef,
  CoreTypedRecordType,
  defaultCoreLinkRelType,
  defaultOperationalLink,
} from "./core-edge.js";

export function supportedDefaultLink(
  source: CoreRecordRef,
  target: CoreRecordRef,
) {
  return defaultOperationalLink(source, target);
}

export function isLinkSupported(
  sourceType: CoreTypedRecordType,
  target: CoreRecordRef,
): target is CoreRecordRef & { recordType: CoreTypedRecordType } {
  if (target.recordType === "record") return false;
  return (
    defaultCoreLinkRelType(sourceType, target.recordType) !== null ||
    defaultCoreLinkRelType(target.recordType, sourceType) !== null
  );
}

export function unsupportedLinkReason(
  sourceType: CoreTypedRecordType,
  target: CoreRecordRef,
): string {
  if (target.recordType === "record") {
    return "Search returned a legacy record shape that the current Core Edge link API cannot link from Raycast.";
  }
  return `${recordTypeLabel(sourceType)} to ${recordTypeLabel(
    target.recordType,
  )} links are not supported by the current Core Edge API.`;
}

export function formatRelType(value: string): string {
  return value.replaceAll("_", " ");
}

function recordTypeLabel(recordType: CoreRecordType): string {
  switch (recordType) {
    case "note":
      return "Note";
    case "task":
      return "Task";
    case "project":
      return "Project";
    case "person":
      return "Person";
    case "organisation":
      return "Organisation";
    case "opportunity":
      return "Opportunity";
    case "record":
      return "Record";
  }
}
