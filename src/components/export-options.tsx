import { useState } from "react";
import {
  ExportFormat,
  ExportOptions as ExportOptionsType,
  SortOrder,
  DateFormat,
  MPesaStatement,
} from "../types";
import { ExportService } from "../services/exportService";
import { WebhookService, WebhookResult } from "../services/webhookService";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import {
  Info,
  Send,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  getDateFormatDisplayName,
  getAllDateFormats,
} from "../utils/dateFormatter";

interface ExportOptionsProps {
  exportFormat: ExportFormat;
  exportOptions: ExportOptionsType;
  statement: MPesaStatement;
  onFormatChange: (format: ExportFormat) => void;
  onOptionsChange: (options: ExportOptionsType) => void;
  /** Open webhook panel on mount (marketing screenshot harness). */
  forceWebhookOpen?: boolean;
  /** Prefill webhook URL for screenshots. */
  forceWebhookEndpoint?: string;
  /** Show a webhook result badge/panel for screenshots. */
  forceWebhookResult?: WebhookResult | null;
}

const SHEET_GROUPS = [
  {
    label: "Data",
    description: "Split your transactions into separate sheets",
    options: [
      {
        key: "includeMoneyInSheet" as keyof ExportOptionsType,
        name: "Money In",
        description: "All transactions where money was received",
      },
      {
        key: "includeMoneyOutSheet" as keyof ExportOptionsType,
        name: "Money Out",
        description: "All transactions where money was spent",
      },
      {
        key: "includeChargesSheet" as keyof ExportOptionsType,
        name: "Charges & Fees",
        description: "All M-PESA transaction charges and fees",
      },
    ],
  },
  {
    label: "Analytics",
    description: "Summaries and patterns across your transactions",
    options: [
      {
        key: "includeSummarySheet" as keyof ExportOptionsType,
        name: "Financial Summary",
        description: "Cash flow, spending patterns, and key financial insights",
      },
      {
        key: "includeBreakdownSheet" as keyof ExportOptionsType,
        name: "Monthly & Weekly",
        description: "Inflows, outflows, and net change aggregated by month and week",
      },
      {
        key: "includeDailyBalanceSheet" as keyof ExportOptionsType,
        name: "Daily Balance",
        description: "Day-by-day balance tracker with highest and lowest points",
      },
      {
        key: "includeTopContactsSheet" as keyof ExportOptionsType,
        name: "Top Contacts",
        description: "Top 20 people/entities you send and receive money from",
      },
      {
        key: "includeRecurringTransactionsSheet" as keyof ExportOptionsType,
        name: "Recurring",
        description: "Counterparties you transact with 3+ times, with predicted next date",
      },
      {
        key: "includeAmountDistributionSheet" as keyof ExportOptionsType,
        name: "Amount Distribution",
        description: "Transactions grouped by amount ranges (e.g. <100, 100–500, >500 KES)",
      },
      {
        key: "includeTimeOfDaySheet" as keyof ExportOptionsType,
        name: "Time of Day",
        description: "Transaction activity by hour — night, morning, afternoon, evening",
      },
    ],
  },
];

const SHEET_OPTIONS = SHEET_GROUPS.flatMap((g) => g.options);

export default function ExportOptions({
  exportFormat,
  exportOptions,
  statement,
  onFormatChange,
  onOptionsChange,
  forceWebhookOpen,
  forceWebhookEndpoint,
  forceWebhookResult,
}: ExportOptionsProps) {
  const [isWebhookOpen, setIsWebhookOpen] = useState(!!forceWebhookOpen);
  const [endpoint, setEndpoint] = useState<string>(forceWebhookEndpoint || "");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [result, setResult] = useState<WebhookResult | null>(
    forceWebhookResult ?? null
  );

  const handleFormatChange = (value: ExportFormat | null) => {
    if (!value) return;
    onFormatChange(value);
  };

  const handleOptionChange = (
    optionKey: keyof ExportOptionsType,
    value: boolean
  ) => {
    onOptionsChange({ ...exportOptions, [optionKey]: value });
  };

  const handleFilterChange = (
    filterKey: keyof ExportOptionsType,
    value: boolean
  ) => {
    onOptionsChange({ ...exportOptions, [filterKey]: value });
  };

  const handleSortChange = (value: SortOrder | null) => {
    if (!value) return;
    onOptionsChange({ ...exportOptions, sortOrder: value });
  };

  const handleDateFormatChange = (value: DateFormat | null) => {
    if (!value) return;
    onOptionsChange({ ...exportOptions, dateFormat: value });
  };

  const handleSend = async () => {
    if (!endpoint.trim()) {
      setResult({ success: false, error: "Please enter a webhook URL" });
      return;
    }
    setIsSending(true);
    setResult(null);
    try {
      const webhookResult = await WebhookService.sendToWebhook(
        statement,
        endpoint,
        exportOptions
      );
      setResult(webhookResult);
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message || "An unexpected error occurred",
      });
    } finally {
      setIsSending(false);
      // Keep the panel open so the result is visible.
      setIsWebhookOpen(true);
    }
  };

  const isValidUrl = endpoint.trim() && WebhookService.isValidUrl(endpoint);
  const allSheetsSelected = SHEET_OPTIONS.every((opt) => exportOptions[opt.key]);

  return (
    <div className="space-y-5">
      {/* ── Export Format ───────────────────────────── */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Export Format
        </Label>
        <Select value={exportFormat} onValueChange={handleFormatChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select export format">
              {ExportService.getFormatDisplayName(exportFormat)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ExportService.getAllFormats().map((format) => (
              <SelectItem key={format} value={format}>
                {ExportService.getFormatDisplayName(format)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Sort + Date side-by-side ─────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Sort By
          </Label>
          <Select
            value={exportOptions.sortOrder || SortOrder.DESC}
            onValueChange={handleSortChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sort order">
                {exportOptions.sortOrder === SortOrder.ASC
                  ? "Oldest First"
                  : "Most Recent First"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SortOrder.DESC}>Most Recent First</SelectItem>
              <SelectItem value={SortOrder.ASC}>Oldest First</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Date Format
          </Label>
          <Select
            value={exportOptions.dateFormat || DateFormat.ISO_FORMAT}
            onValueChange={handleDateFormatChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Date format">
                {getDateFormatDisplayName(
                  exportOptions.dateFormat || DateFormat.ISO_FORMAT
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {getAllDateFormats().map((format) => (
                <SelectItem key={format} value={format}>
                  {getDateFormatDisplayName(format)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Filter toggle ────────────────────────────── */}
      <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Checkbox
            id="filter-charges"
            checked={exportOptions.filterOutCharges || false}
            onCheckedChange={(value) =>
              handleFilterChange("filterOutCharges", Boolean(value))
            }
          />
          <Label htmlFor="filter-charges" className="text-sm cursor-pointer">
            Filter out charges and fees
          </Label>
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <Info className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-help shrink-0" />
            }
          />
          <TooltipContent className="max-w-xs">
            <p>
              Excludes transactions containing "charge" in the details from the
              main transactions sheet
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* ── Webhook ─────────────────────────────────── */}
      <div className="rounded-lg border border-border/60 overflow-hidden">
        <button
          type="button"
          onClick={() => setIsWebhookOpen(!isWebhookOpen)}
          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Send to Webhook</span>
            {/* Status badge — visible even when panel is collapsed */}
            {result && !isWebhookOpen && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium",
                  result.success
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                )}
              >
                {result.success ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                {result.success ? "Sent" : "Failed"}
              </span>
            )}
          </div>
          {isWebhookOpen ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {isWebhookOpen && (
          <div className="px-3 pb-3 pt-2 border-t border-border/60 space-y-3">
            <p className="text-xs text-muted-foreground">
              Send your transaction data as JSON to a webhook endpoint for
              reconciliation or integration with external systems.
            </p>
            <div className="flex gap-2">
              <Input
                id="endpoint-url"
                type="url"
                placeholder="https://api.example.com/webhook"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                disabled={isSending}
                className="flex-1 text-sm"
              />
              <Button
                onClick={handleSend}
                disabled={isSending || !isValidUrl}
                size="sm"
                className="shrink-0"
              >
                {isSending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>

            {result && (
              <div
                className={cn(
                  "rounded-md border px-2.5 py-2 flex items-start gap-2",
                  result.success
                    ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900"
                    : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900"
                )}
              >
                {result.success ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 flex-1">
                  <p
                    className={cn(
                      "text-xs font-medium",
                      result.success
                        ? "text-green-800 dark:text-green-300"
                        : "text-red-800 dark:text-red-300"
                    )}
                  >
                    {result.success
                      ? "Successfully sent to webhook"
                      : "Failed to send data"}
                  </p>
                  {result.statusCode && (
                    <p className="text-xs text-muted-foreground">
                      Status: {result.statusCode} {result.statusText}
                    </p>
                  )}
                  {result.error && (
                    <p className="text-xs text-red-700 dark:text-red-400 break-words">
                      {result.error}
                    </p>
                  )}
                  {result.responseBody && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        View response
                      </summary>
                      <pre className="mt-1.5 p-2 bg-muted rounded text-xs overflow-x-auto max-h-24">
                        {result.responseBody}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Additional Sheets (XLSX only) ───────────── */}
      {exportFormat === ExportFormat.XLSX && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Additional Sheets
            </Label>
            <button
              type="button"
              onClick={() => {
                const newOptions: ExportOptionsType = { ...exportOptions };
                SHEET_OPTIONS.forEach((opt) => {
                  (newOptions as any)[opt.key] = !allSheetsSelected;
                });
                onOptionsChange(newOptions);
              }}
              className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
            >
              {allSheetsSelected ? "Deselect all" : "Select all"}
            </button>
          </div>

          <div className="space-y-3">
            {SHEET_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-xs text-muted-foreground mb-1.5">{group.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.options.map((option) => {
                    const isSelected = Boolean(exportOptions[option.key]);
                    return (
                      <Tooltip key={option.key}>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              onClick={() => handleOptionChange(option.key, !isSelected)}
                              className={cn(
                                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all cursor-pointer select-none",
                                isSelected
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground"
                              )}
                            >
                              {option.name}
                            </button>
                          }
                        />
                        <TooltipContent className="max-w-xs">
                          <p>{option.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
