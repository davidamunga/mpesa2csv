export const TIMEOUTS = {
  PDF_PROCESSING: 60000,
} as const;

export const URLS = {
  CHANGELOG:
    "https://raw.githubusercontent.com/DavidAmunga/mpesa2csv/main/CHANGELOG.md",
  RELEASES: "https://github.com/DavidAmunga/mpesa2csv/releases/latest",
  FEEDBACK: "https://mpesa2csv.com/feedback",
  TWITTER: "https://twitter.com/davidamunga_",
} as const;

export const FILE_PREFIXES = {
  TEMP_INPUT: "mpesa_temp_",
  TEMP_OUTPUT: "mpesa_output_",
} as const;

export const APP_METADATA = {
  CREATOR: "mpesa2csv",
} as const;
