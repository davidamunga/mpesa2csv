export interface MPesaStatement {
  transactions: Transaction[];
  fileName?: string;
  totalCharges: number;
}

export interface Transaction {
  receiptNo: string;
  completionTime: string;
  details: string;
  transactionStatus: string;
  paidIn: number | null;
  withdrawn: number | null;
  balance: number;
  raw: string;
  otherParty?: string;
  transactionType?: string;
}

export enum FileStatus {
  IDLE = "idle",
  LOADING = "loading",
  PROTECTED = "protected",
  PROCESSING = "processing",
  SUCCESS = "success",
  ERROR = "error",
}

export enum ExportFormat {
  CSV = "csv",
  XLSX = "xlsx",
  JSON = "json",
  OFX = "ofx",
  QFX = "qfx",
  QIF = "qif",
}

export enum SortOrder {
  DESC = "desc",
  ASC = "asc",
}

export enum DateFormat {
  ISO_FORMAT = "iso_format",
  DD_MMM_YYYY = "dd_mmm_yyyy",
  DD_MMM_YYYY_SLASH = "dd_mmm_yyyy_slash",
}

export interface ExportOptions {
  includeChargesSheet?: boolean;
  includeSummarySheet?: boolean;
  includeBreakdownSheet?: boolean;
  includeDailyBalanceSheet?: boolean;
  includeAmountDistributionSheet?: boolean;
  includeTopContactsSheet?: boolean;
  includeMoneyInSheet?: boolean;
  includeMoneyOutSheet?: boolean;
  includeRecurringTransactionsSheet?: boolean;
  includeTimeOfDaySheet?: boolean;
  // Filter options
  filterOutCharges?: boolean;
  sortOrder?: SortOrder;
  // Date format options
  dateFormat?: DateFormat;
}
