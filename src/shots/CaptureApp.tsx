import { useEffect, useMemo, useState } from "react";
import {
  Download,
  RotateCcw,
  MessageSquare,
  ChevronDown,
  Table2,
  X,
  Settings2,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import NumberFlow from "@number-flow/react";
import FileUploader from "../components/file-uploader";
import PasswordPrompt from "../components/password-prompt";
import ExportOptions from "../components/export-options";
import { Button } from "../components/ui/button";
import {
  FileStatus,
  ExportFormat,
  type ExportOptions as ExportOptionsType,
  type MPesaStatement,
} from "../types";
import { ExportService } from "../services/exportService";
import { cn } from "@/lib/utils";
import stubFixture from "./fixture.stub.json";

// Prefer a locally generated fixture.json (gitignored) when present for
// marketing screenshots; fall back to the committed stub for CI/builds.
const localFixtures = import.meta.glob<{ default: typeof stubFixture }>(
  "./fixture.json",
  { eager: true }
);
const fixture = localFixtures["./fixture.json"]?.default ?? stubFixture;

export type ShotId =
  | "dropzone"
  | "dropzone-drag"
  | "dropzone-error"
  | "unlock"
  | "unlock-batch"
  | "unlock-error"
  | "processing"
  | "processing-batch"
  | "success"
  | "preview"
  | "export"
  | "sheets"
  | "csv"
  | "webhook"
  | "saved";

export const SHOTS: ShotId[] = [
  "dropzone",
  "dropzone-drag",
  "dropzone-error",
  "unlock",
  "unlock-batch",
  "unlock-error",
  "processing",
  "processing-batch",
  "success",
  "preview",
  "export",
  "sheets",
  "csv",
  "webhook",
  "saved",
];

function useShotParam(): ShotId {
  const params = new URLSearchParams(window.location.search);
  const shot = (params.get("shot") || "dropzone") as ShotId;
  return SHOTS.includes(shot) ? shot : "dropzone";
}

function useThemeParam() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const theme = params.get("theme") || "light";
    localStorage.setItem("theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, []);
}

const ALL_SHEETS: ExportOptionsType = {
  includeMoneyInSheet: true,
  includeMoneyOutSheet: true,
  includeChargesSheet: true,
  includeSummarySheet: true,
  includeBreakdownSheet: true,
  includeDailyBalanceSheet: true,
  includeTopContactsSheet: true,
  includeRecurringTransactionsSheet: true,
  includeAmountDistributionSheet: true,
  includeTimeOfDaySheet: true,
  includeReversalsSheet: true,
  includePayBillsTillsSheet: true,
  filterOutCharges: true,
};

export default function CaptureApp() {
  const shot = useShotParam();
  useThemeParam();

  const statement = fixture.statement as MPesaStatement;
  const fileName = fixture.fileName;

  const exportFormat =
    shot === "csv" ? ExportFormat.CSV : ExportFormat.XLSX;

  const [exportOptions, setExportOptions] = useState<ExportOptionsType>(() => {
    if (shot === "sheets") return ALL_SHEETS;
    if (shot === "csv") return { filterOutCharges: true };
    return {
      includeMoneyInSheet: true,
      includeMoneyOutSheet: true,
      includeRecurringTransactionsSheet: true,
      includeTimeOfDaySheet: true,
      includeSummarySheet: true,
      filterOutCharges: true,
    };
  });

  const previewExpanded = shot === "preview";
  const optionsExpanded =
    shot === "export" ||
    shot === "sheets" ||
    shot === "csv" ||
    shot === "webhook";

  const status = useMemo(() => {
    switch (shot) {
      case "dropzone":
      case "dropzone-drag":
      case "dropzone-error":
        return FileStatus.IDLE;
      case "unlock":
      case "unlock-batch":
      case "unlock-error":
        return FileStatus.PROTECTED;
      case "processing":
      case "processing-batch":
        return FileStatus.PROCESSING;
      default:
        return FileStatus.SUCCESS;
    }
  }, [shot]);

  const txs = statement.transactions;
  const dates = txs
    .map((t) => new Date(t.completionTime))
    .filter((d) => !isNaN(d.getTime()));
  const minDate = dates.length
    ? new Date(Math.min(...dates.map((d) => d.getTime())))
    : null;
  const maxDate = dates.length
    ? new Date(Math.max(...dates.map((d) => d.getTime())))
    : null;
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const dateRange =
    minDate && maxDate
      ? fmt(minDate) === fmt(maxDate)
        ? fmt(minDate)
        : `${fmt(minDate)} – ${fmt(maxDate)}`
      : null;
  const totalIn = txs.reduce((s, t) => s + (t.paidIn ?? 0), 0);
  const totalOut = txs.reduce((s, t) => s + (t.withdrawn ?? 0), 0);
  const abbr = (n: number) => {
    if (n >= 1_000_000)
      return `${(n / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}M`;
    if (n >= 1_000)
      return `${(n / 1_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}K`;
    return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  };

  const tall =
    shot === "preview" ||
    shot === "export" ||
    shot === "sheets" ||
    shot === "csv" ||
    shot === "webhook";
  const compactHero =
    shot === "preview" ||
    shot === "export" ||
    shot === "sheets" ||
    shot === "csv" ||
    shot === "webhook";
  const hidePreview =
    shot === "export" ||
    shot === "sheets" ||
    shot === "csv" ||
    shot === "webhook";
  const hideExportPanel = shot === "preview" || shot === "saved" || shot === "success";
  const showSavedChip = shot === "saved";

  const frameHeight =
    shot === "sheets" || shot === "webhook"
      ? "h-[820px]"
      : shot === "export" || shot === "csv"
        ? "h-[780px]"
        : tall
          ? "h-[720px]"
          : "h-[550px]";

  return (
    <div className="min-h-screen bg-[#c8cdd3] dark:bg-[#1a1d21] flex items-center justify-center p-6">
      <div
        data-shot-frame
        className={cn(
          "w-[600px] rounded-xl overflow-hidden shadow-2xl border border-black/10 dark:border-white/10 bg-background text-foreground flex flex-col",
          frameHeight
        )}
      >
        <div className="flex items-center gap-2 px-3 h-10 border-b border-border/60 bg-muted/40 shrink-0">
          <div className="flex gap-1.5">
            <span className="size-3 rounded-full bg-[#ff5f57]" />
            <span className="size-3 rounded-full bg-[#febc2e]" />
            <span className="size-3 rounded-full bg-[#28c840]" />
          </div>
          <p className="flex-1 text-center text-[11px] text-muted-foreground truncate pr-12">
            mpesa2csv - Convert M-PESA Statements to CSV/Excel
          </p>
        </div>

        <div className="flex-1 flex flex-col min-h-0 px-5 pt-4 pb-2">
          <main className="flex-1 min-h-0 overflow-auto">
            {status === FileStatus.IDLE ? (
              <FileUploader
                onFilesSelected={() => {}}
                status={status}
                forceDragActive={shot === "dropzone-drag"}
                forceError={
                  shot === "dropzone-error"
                    ? "Please select only PDF files."
                    : undefined
                }
              />
            ) : status === FileStatus.PROTECTED ? (
              <PasswordPrompt
                onPasswordSubmit={() => {}}
                onSkip={shot === "unlock-batch" ? () => {} : undefined}
                onReset={() => {}}
                status={status}
                error={
                  shot === "unlock-error"
                    ? "Incorrect password. Please try again."
                    : undefined
                }
                currentFileName={fileName}
                currentFileIndex={shot === "unlock-batch" ? 1 : 0}
                totalFiles={shot === "unlock-batch" ? 3 : 1}
              />
            ) : status === FileStatus.PROCESSING ? (
              <div className="flex flex-col items-center justify-center gap-6 py-12 text-center h-full">
                <div className="relative w-14 h-14">
                  <div className="w-14 h-14 rounded-full border-[3px] border-muted" />
                  <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-primary animate-spin" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold">
                    Processing your statements
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {shot === "processing-batch"
                      ? "File 2 of 3"
                      : "Extracting transactions…"}
                  </p>
                </div>
                <div className="w-56 space-y-2">
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{
                        width: shot === "processing-batch" ? "66%" : "65%",
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {shot === "processing-batch"
                      ? "MPESA_Statement_client_B.pdf"
                      : fileName}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="space-y-3 max-w-lg mx-auto w-full pb-2">
                <div
                  className={cn(
                    "text-center",
                    compactHero ? "pt-1 pb-1" : "pt-2 pb-2"
                  )}
                >
                  <NumberFlow
                    value={statement.transactions.length}
                    format={{ useGrouping: true }}
                    className={cn(
                      "font-bold tracking-tight leading-none",
                      compactHero ? "text-4xl" : "text-7xl"
                    )}
                  />
                  <p
                    className={cn(
                      "text-muted-foreground text-sm",
                      compactHero ? "mt-1" : "mt-3"
                    )}
                  >
                    transactions extracted
                    {shot === "saved" ? " from 1 statement" : ""}
                  </p>
                  {!compactHero && dateRange && (
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      {dateRange}
                    </p>
                  )}
                  {!compactHero && (
                    <>
                      <div className="flex items-center justify-center gap-3 mt-3 text-xs">
                        <span className="text-green-500/90">
                          ↑ KES {abbr(totalIn)}
                        </span>
                        <span className="text-muted-foreground/30">·</span>
                        <span className="text-red-400/80">
                          ↓ KES {abbr(totalOut)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground/50 mt-1">
                        KES{" "}
                        {statement.totalCharges.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        in charges
                      </p>
                    </>
                  )}
                </div>

                {(shot === "success" || shot === "saved") && (
                  <Button size="lg" className="w-full">
                    <Download className="w-4 h-4" />
                    Export as {ExportService.getFormatDisplayName(exportFormat)}
                  </Button>
                )}

                {showSavedChip && (
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">
                      ~/Downloads/mpesa_statement_2025-09.xlsx
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs shrink-0"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Open
                    </Button>
                  </div>
                )}

                {!hidePreview && (
                  <div className="border border-border/60 rounded-lg overflow-hidden">
                    <div className="w-full flex items-center justify-between px-3 py-2.5 text-left">
                      <div className="flex items-center gap-2">
                        <Table2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          Preview transactions
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({statement.transactions.length.toLocaleString()})
                        </span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-muted-foreground transition-transform",
                          previewExpanded && "rotate-180"
                        )}
                      />
                    </div>
                    {previewExpanded && (
                      <div className="border-t border-border/60 overflow-x-auto max-h-64">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-muted/60">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">
                                Date
                              </th>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                                Details
                              </th>
                              <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">
                                Paid In
                              </th>
                              <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">
                                Withdrawn
                              </th>
                              <th className="text-right px-3 py-2 font-medium text-muted-foreground">
                                Balance
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {statement.transactions.slice(0, 10).map((tx, i) => (
                              <tr
                                key={i}
                                className={
                                  i % 2 === 0 ? "bg-background" : "bg-muted/20"
                                }
                              >
                                <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                                  {tx.completionTime}
                                </td>
                                <td className="px-3 py-1.5 max-w-[180px] truncate">
                                  {tx.details}
                                </td>
                                <td className="px-3 py-1.5 text-right text-green-600 dark:text-green-400">
                                  {tx.paidIn ? tx.paidIn.toLocaleString() : ""}
                                </td>
                                <td className="px-3 py-1.5 text-right text-red-500 dark:text-red-400">
                                  {tx.withdrawn
                                    ? tx.withdrawn.toLocaleString()
                                    : ""}
                                </td>
                                <td className="px-3 py-1.5 text-right font-medium">
                                  {tx.balance.toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {!hideExportPanel && (
                  <div className="border border-border/60 rounded-lg overflow-hidden">
                    <div className="w-full flex items-center justify-between px-3 py-2.5 text-left">
                      <div className="flex items-center gap-2">
                        <Settings2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          Customize export
                        </span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-muted-foreground transition-transform",
                          optionsExpanded && "rotate-180"
                        )}
                      />
                    </div>
                    {optionsExpanded && (
                      <div className="border-t border-border/60 p-4">
                        <ExportOptions
                          exportFormat={exportFormat}
                          exportOptions={exportOptions}
                          statement={statement}
                          onFormatChange={() => {}}
                          onOptionsChange={setExportOptions}
                          forceWebhookOpen={shot === "webhook"}
                          forceWebhookEndpoint={
                            shot === "webhook"
                              ? "https://hooks.example.com/mpesa"
                              : undefined
                          }
                          forceWebhookResult={
                            shot === "webhook"
                              ? { success: true, statusCode: 200 }
                              : null
                          }
                        />
                      </div>
                    )}
                  </div>
                )}

                {(shot === "success" ||
                  shot === "saved" ||
                  shot === "preview") && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Share feedback
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <RotateCcw className="w-3 h-3" />
                      Start over
                    </span>
                  </div>
                )}
              </div>
            )}
          </main>

          <footer className="flex-shrink-0 py-3">
            <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
              <span>Private · Offline · Free</span>
              <span aria-hidden>·</span>
              <span>v1.0.2</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
