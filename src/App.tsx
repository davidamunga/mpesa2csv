import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { platform } from "@tauri-apps/plugin-os";
import {
  Download,
  RotateCcw,
  ExternalLink,
  MessageSquare,
  ChevronDown,
  Table2,
  X,
  CheckCircle2,
  Settings2,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";

import {
  MPesaStatement,
  FileStatus,
  ExportFormat,
  ExportOptions as ExportOptionsType,
} from "./types";
import { TabulaService } from "./services/tabulaService";
import { ExportService } from "./services/exportService";
import FileUploader from "./components/file-uploader";
import PasswordPrompt from "./components/password-prompt";
import ExportOptions from "./components/export-options";
import { UpdateChecker } from "./components/update-checker";
import { ThemeToggle } from "./components/theme-toggle";
import { Button } from "./components/ui/button";
import { formatDateForFilename } from "./utils/helpers";
import { TIMEOUTS, URLS } from "./constants";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";

function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<FileStatus>(FileStatus.IDLE);
  const [error, setError] = useState<string | undefined>(undefined);
  const [statements, setStatements] = useState<MPesaStatement[]>([]);
  const [exportFileName, setExportFileName] = useState<string>("");
  // Ref to signal in-flight processFiles loop to stop (cancel button).
  const cancelRequested = useRef(false);
  // Controls the transaction-preview panel.
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [optionsExpanded, setOptionsExpanded] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>(
    ExportFormat.XLSX
  );
  const [exportOptions, setExportOptions] = useState<ExportOptionsType>({
    includeChargesSheet: false,
    includeSummarySheet: false,
    includeBreakdownSheet: false,
    includeDailyBalanceSheet: false,
    includeTopContactsSheet: false,
  });
  const [currentFileIndex, setCurrentFileIndex] = useState<number>(0);
  // Holds statements processed before a mid-batch password prompt so they
  // are not lost when handlePasswordSubmit runs (statements state is still []).
  const pendingStatements = useRef<MPesaStatement[]>([]);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [appVersion, setAppVersion] = useState<string>("");
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const [savedFilePath, setSavedFilePath] = useState<string>("");
  const [currentPlatform, setCurrentPlatform] = useState<string>("");

  const getDefaultFileName = () => {
    return (
      exportFileName ||
      `mpesa_statement.${ExportService.getFileExtension(exportFormat)}`
    );
  };

  const prepareFileContent = async (statement: MPesaStatement) => {
    const arrayBuffer = await ExportService.getFileBuffer(
      statement,
      exportFormat,
      exportOptions
    );
    const content = new Uint8Array(arrayBuffer);
    return Array.from(content);
  };

  const handleFormatChange = (format: ExportFormat) => {
    setExportFormat(format);
    const combinedStatement = statements[0];
    const fileName = ExportService.getFileName(
      combinedStatement,
      format,
      formatDateForFilename()
    );
    setExportFileName(fileName);
  };

  const handleOptionsChange = (options: ExportOptionsType) => {
    setExportOptions(options);
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const version = await invoke<string>("get_app_version");
        setAppVersion(version);
        setCurrentPlatform(platform());
      } catch (error) {
        if (error instanceof Error) {
          console.error("App initialization failed:", error.message);
        }
      }
    };
    initializeApp();
  }, []);

  const handleFilesSelected = async (selectedFiles: File[]) => {
    cancelRequested.current = false;
    setFiles(selectedFiles);
    setStatus(FileStatus.LOADING);
    setError(undefined);
    setStatements([]);
    setCurrentFileIndex(0);
    setPreviewExpanded(false);
    setOptionsExpanded(false);

    try {
      const result = await processFiles(selectedFiles);
      if (result?.cancelled) return;
      if (result?.needsPassword) {
        pendingStatements.current = result.processedStatements;
      } else if (result?.error) {
        setStatus(FileStatus.ERROR);
        setError(result.error);
      }
    } catch (error: any) {
      setStatus(FileStatus.ERROR);
      setError(
        error.message || "An unexpected error occurred while processing files"
      );
    }
  };

  const processFiles = async (
    filesToProcess: File[],
    startIndex: number = 0,
    existingStatements: MPesaStatement[] = []
  ) => {
    const processedStatements: MPesaStatement[] = [...existingStatements];

    for (let i = startIndex; i < filesToProcess.length; i++) {
      if (cancelRequested.current) break;
      setCurrentFileIndex(i);
      const file = filesToProcess[i];

      try {
        setStatus(FileStatus.PROCESSING);

        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
        const extractionPromise = TabulaService.extractTablesFromPdf(file);
        const timeoutPromise = new Promise<string>((_, reject) => {
          timeoutHandle = setTimeout(async () => {
            try {
              await invoke("cancel_pdf_extraction");
            } catch {
              // best-effort cancel — ignore errors
            }
            reject(
              new Error(
                `PDF processing timeout after ${
                  TIMEOUTS.PDF_PROCESSING / 1000
                } seconds`
              )
            );
          }, TIMEOUTS.PDF_PROCESSING);
        });

        const csvContent = await Promise.race([
          extractionPromise.finally(() => clearTimeout(timeoutHandle)),
          timeoutPromise,
        ]);

        const statement = TabulaService.parseTabulaCSV(csvContent);
        if (statement.transactions.length === 0) {
          throw new Error(
            `No transactions found in "${file.name}". The file may not be a valid M-PESA statement.`
          );
        }
        statement.fileName = file.name;
        processedStatements.push(statement);
      } catch (err: any) {
        if (cancelRequested.current) {
          return { cancelled: true, fileIndex: i, processedStatements };
        }
        if (
          err.message?.includes("password") ||
          err.message?.includes("encrypted") ||
          err.message?.includes("protected")
        ) {
          setStatus(FileStatus.PROTECTED);
          return { needsPassword: true, fileIndex: i, processedStatements };
        }

        setStatus(FileStatus.ERROR);
        setError(err.message || "Failed to process the PDF file");
        return {
          needsPassword: false,
          fileIndex: i,
          processedStatements,
          error: err.message,
        };
      }
    }

    if (cancelRequested.current) {
      return { cancelled: true, fileIndex: filesToProcess.length, processedStatements };
    }

    if (processedStatements.length > 0) {
      const combinedStatement = combineStatements(processedStatements);
      setStatements([combinedStatement]);

      const fileName = ExportService.getFileName(
        combinedStatement,
        exportFormat,
        formatDateForFilename()
      );
      setExportFileName(fileName);
      setStatus(FileStatus.SUCCESS);
    }

    return {
      needsPassword: false,
      fileIndex: filesToProcess.length,
      processedStatements,
    };
  };

  const combineStatements = (statements: MPesaStatement[]): MPesaStatement => {
    if (statements.length === 1) {
      return statements[0];
    }

    const allTransactions = statements.flatMap((s) => s.transactions);

    allTransactions.sort((a, b) => {
      const dateA = new Date(a.completionTime);
      const dateB = new Date(b.completionTime);
      return dateA.getTime() - dateB.getTime();
    });

    const totalCharges = TabulaService.calculateTotalCharges(allTransactions);

    return {
      transactions: allTransactions,
      fileName: `Combined_${statements.length}_statements`,
      totalCharges,
    };
  };

  const handlePasswordSubmit = async (password: string) => {
    if (files.length === 0) return;

    setStatus(FileStatus.PROCESSING);
    setError(undefined);

    try {
      const currentFile = files[currentFileIndex];

      const csvContent = await TabulaService.extractTablesFromPdf(
        currentFile,
        password
      );
      const statement = TabulaService.parseTabulaCSV(csvContent);
      statement.fileName = currentFile.name;

      // Use the ref so already-processed files are not lost (statements state
      // is still [] when processFiles returned early for a password prompt).
      const updatedStatements = [...pendingStatements.current, statement];
      pendingStatements.current = [];
      setStatements(updatedStatements);

      const nextIndex = currentFileIndex + 1;
      if (nextIndex < files.length) {
        const result = await processFiles(files, nextIndex, updatedStatements);
        if (result?.needsPassword) {
          // Another file in the batch needs a password; persist current progress.
          pendingStatements.current = result.processedStatements;
        } else if (result?.error) {
          setStatus(FileStatus.ERROR);
          setError(result.error);
        }
      } else {
        const combinedStatement = combineStatements(updatedStatements);
        const fileName = ExportService.getFileName(
          combinedStatement,
          exportFormat,
          formatDateForFilename()
        );
        setExportFileName(fileName);
        setStatus(FileStatus.SUCCESS);
      }
    } catch (err: any) {
      setStatus(FileStatus.PROTECTED);
      setError(err.message || "Incorrect password. Please try again.");
    }
  };

  const handleSkipFile = async () => {
    if (files.length === 0) return;

    setError(undefined);
    const nextIndex = currentFileIndex + 1;

    if (nextIndex < files.length) {
      const result = await processFiles(files, nextIndex, statements);
      if (result?.error) {
        setStatus(FileStatus.ERROR);
        setError(result.error);
      }
    } else {
      if (statements.length > 0) {
        const combinedStatement = combineStatements(statements);
        const fileName = ExportService.getFileName(
          combinedStatement,
          exportFormat,
          formatDateForFilename()
        );
        setExportFileName(fileName);
        setStatus(FileStatus.SUCCESS);
      } else {
        setStatus(FileStatus.IDLE);
        setFiles([]);
        setCurrentFileIndex(0);
      }
    }
  };

  const handleReset = () => {
    cancelRequested.current = false;
    setFiles([]);
    setStatus(FileStatus.IDLE);
    setError(undefined);
    setStatements([]);
    setCurrentFileIndex(0);
    pendingStatements.current = [];
    setIsDownloading(false);
    setDownloadSuccess(false);
    setSavedFilePath("");
    setExportFileName("");
    setPreviewExpanded(false);
    setOptionsExpanded(false);
  };

  const handleCancel = async () => {
    cancelRequested.current = true;
    try {
      await invoke("cancel_pdf_extraction");
    } catch {
      // best-effort — ignore if no process is running
    }
    setStatus(FileStatus.IDLE);
    setFiles([]);
    setStatements([]);
    setCurrentFileIndex(0);
    pendingStatements.current = [];
    setError(undefined);
  };

  const handleDownloadError = (error: any) => {
    const errorMessage =
      typeof error === "string" ? error : error.message || error.toString();

    if (errorMessage.includes("cancelled")) {
      setError(undefined);
    } else if (errorMessage.includes("permission")) {
      setError(
        "Permission denied. Please check app permissions and try again."
      );
    } else if (errorMessage.includes("space")) {
      setError("Not enough storage space. Please free up space and try again.");
    } else {
      setError(`Failed to save file: ${errorMessage}`);
    }
  };

  const handleDownload = async () => {
    if (statements.length === 0 || isDownloading) return;

    setIsDownloading(true);
    setError(undefined);

    try {
      const combinedStatement = statements[0];
      const fileName = getDefaultFileName();

      if (currentPlatform === "android") {
        const arrayBuffer = await ExportService.getFileBuffer(
          combinedStatement,
          exportFormat,
          exportOptions
        );

        let mimeType: string;
        switch (exportFormat) {
          case ExportFormat.CSV:
            mimeType = "text/csv";
            break;
          case ExportFormat.JSON:
            mimeType = "application/json";
            break;
          case ExportFormat.XLSX:
            mimeType =
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            break;
          case ExportFormat.OFX:
            mimeType = "application/x-ofx";
            break;
          case ExportFormat.QFX:
            mimeType = "application/x-qfx";
            break;
          case ExportFormat.QIF:
            mimeType = "application/x-qif";
            break;
          default:
            mimeType = "application/octet-stream";
        }

        const dataArray = Array.from(new Uint8Array(arrayBuffer));

        const result = await invoke<{
          fileName: string;
          path?: string;
          uri?: string;
        }>("plugin:pldownloader|save_file_public_from_buffer", {
          payload: {
            data: dataArray,
            fileName: fileName,
            mimeType: mimeType,
          },
        });

        setError(undefined);
        setDownloadSuccess(true);

        const filePath = result.path || result.uri || fileName;
        setSavedFilePath(filePath);
      } else {
        const contentArray = await prepareFileContent(combinedStatement);

        const invokeParams = {
          content: contentArray,
          defaultFilename: fileName,
          fileType: ExportService.getFileExtension(exportFormat),
        };

        const result = await invoke<string>("save_file", invokeParams);

        setError(undefined);
        setDownloadSuccess(true);
        setSavedFilePath(result);
      }
    } catch (error: any) {
      handleDownloadError(error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenFile = async () => {
    try {
      if (savedFilePath) {
        const filePath = savedFilePath.replace(
          "File saved successfully to: ",
          ""
        );
        await invoke("open_file", { path: filePath });
      }
    } catch (error: any) {
      setError(`Failed to open file: ${error.message || error.toString()}`);
    }
  };

  const handleOpenFeedback = async () => {
    try {
      await openUrl(URLS.FEEDBACK);
    } catch (error: any) {
      if (error instanceof Error) {
        console.error("Failed to open feedback page:", error.message);
      }
    }
  };


  return (
    <div className="min-h-screen flex flex-col">
      <UpdateChecker autoCheck={true} />
      <div className="flex-1 mx-auto px-4 py-4 flex flex-col max-w-4xl w-full overflow-y-auto">
        <main className={cn(
          "flex-1 flex justify-center py-4",
          status === FileStatus.SUCCESS
            ? "items-start pt-10"
            : "items-center"
        )}>
          <div className="w-full max-w-2xl transition-all duration-300 ease-in-out">
            {status === FileStatus.IDLE ||
            status === FileStatus.LOADING ||
            status === FileStatus.ERROR ? (
              <div className="space-y-3 transition-all duration-300">
                <FileUploader
                  onFilesSelected={handleFilesSelected}
                  status={status}
                />
                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 transition-all duration-300">
                    <p className="text-destructive text-sm">{error}</p>
                  </div>
                )}
              </div>
            ) : status === FileStatus.PROTECTED ? (
              <div className="transition-all duration-300">
                <PasswordPrompt
                  onPasswordSubmit={handlePasswordSubmit}
                  onSkip={handleSkipFile}
                  onReset={handleReset}
                  status={status}
                  error={error}
                  currentFileName={files[currentFileIndex]?.name}
                  currentFileIndex={currentFileIndex}
                  totalFiles={files.length}
                />
              </div>
            ) : status === FileStatus.PROCESSING ? (
              <div className="flex flex-col items-center justify-center gap-6 py-12 text-center">
                {/* Spinner */}
                <div className="relative w-14 h-14">
                  <div className="w-14 h-14 rounded-full border-[3px] border-muted" />
                  <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-primary animate-spin" />
                </div>

                {/* Text */}
                <div className="space-y-1">
                  <h3 className="text-base font-semibold">Processing your statements</h3>
                  <p className="text-sm text-muted-foreground">
                    {files.length > 1
                      ? `File ${currentFileIndex + 1} of ${files.length}`
                      : "Extracting transactions…"}
                  </p>
                </div>

                {/* Progress bar + file name */}
                <div className="w-56 space-y-2">
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{
                        width: `${((currentFileIndex + 1) / files.length) * 100}%`,
                      }}
                    />
                  </div>
                  {files[currentFileIndex] && (
                    <p className="text-xs text-muted-foreground truncate">
                      {files[currentFileIndex].name}
                    </p>
                  )}
                </div>

                {/* Cancel button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  className="gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </Button>
              </div>
            ) : status === FileStatus.SUCCESS && statements.length > 0 ? (
              <div className="space-y-3 transition-all duration-300 max-w-lg mx-auto w-full">

                {/* ── Stats hero ──────────────────────────────────── */}
                <div className="text-center pt-6 pb-2">
                  <NumberFlow
                    value={statements[0].transactions.length}
                    format={{ useGrouping: true }}
                    className="text-7xl font-bold tracking-tight leading-none"
                  />
                  <p className="text-muted-foreground mt-3 text-sm">
                    transaction{statements[0].transactions.length !== 1 ? "s" : ""} extracted
                    {files.length > 1 ? ` from ${files.length} statements` : ""}
                  </p>
                  {statements[0].totalCharges > 0 && (
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      KES {statements[0].totalCharges.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} in charges
                    </p>
                  )}
                </div>

                {/* ── Primary export action ───────────────────────── */}
                <Button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  size="lg"
                  className="w-full"
                >
                  {isDownloading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                      Exporting…
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Export as {ExportService.getFormatDisplayName(exportFormat)}
                    </>
                  )}
                </Button>

                {/* ── Post-save confirmation chip ─────────────────── */}
                {downloadSuccess && savedFilePath && (
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">
                      {savedFilePath}
                    </span>
                    <Button
                      onClick={handleOpenFile}
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs shrink-0"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Open
                    </Button>
                  </div>
                )}

                {/* ── Error ───────────────────────────────────────── */}
                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                    <p className="text-destructive text-sm">{error}</p>
                  </div>
                )}

                {/* ── Transaction Preview ─────────────────────────── */}
                <div className="border border-border/60 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setPreviewExpanded((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Table2 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Preview transactions</span>
                      <span className="text-xs text-muted-foreground">
                        ({statements[0].transactions.length.toLocaleString()})
                      </span>
                    </div>
                    <ChevronDown className={cn(
                      "w-4 h-4 text-muted-foreground transition-transform duration-200",
                      previewExpanded && "rotate-180"
                    )} />
                  </button>

                  <div className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out",
                    previewExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  )}>
                    <div className="overflow-hidden">
                      <div className="border-t border-border/60 overflow-x-auto max-h-64">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-muted/60">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Date</th>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Details</th>
                              <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Paid In</th>
                              <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Withdrawn</th>
                              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {statements[0].transactions.slice(0, 10).map((tx, i) => (
                              <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                                <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{tx.completionTime}</td>
                                <td className="px-3 py-1.5 max-w-[180px] truncate">{tx.details}</td>
                                <td className="px-3 py-1.5 text-right text-green-600 dark:text-green-400">
                                  {tx.paidIn ? tx.paidIn.toLocaleString() : ""}
                                </td>
                                <td className="px-3 py-1.5 text-right text-red-500 dark:text-red-400">
                                  {tx.withdrawn ? tx.withdrawn.toLocaleString() : ""}
                                </td>
                                <td className="px-3 py-1.5 text-right font-medium">{tx.balance.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {statements[0].transactions.length > 10 && (
                          <p className="text-xs text-center text-muted-foreground py-2 bg-muted/20 border-t border-border/40">
                            Showing 10 of {statements[0].transactions.length} — export to see all
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Customize export (collapsible, closed by default) */}
                <div className="border border-border/60 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOptionsExpanded((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Customize export</span>
                    </div>
                    <ChevronDown className={cn(
                      "w-4 h-4 text-muted-foreground transition-transform duration-200",
                      optionsExpanded && "rotate-180"
                    )} />
                  </button>

                  <div className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out",
                    optionsExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  )}>
                    <div className="overflow-hidden">
                      <div className="border-t border-border/60 p-4">
                        <ExportOptions
                          exportFormat={exportFormat}
                          exportOptions={exportOptions}
                          statement={statements[0]}
                          onFormatChange={handleFormatChange}
                          onOptionsChange={handleOptionsChange}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Tertiary actions ─────────────────────────────── */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={handleOpenFeedback}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Share feedback
                  </button>
                  <button
                    onClick={handleReset}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Start over
                  </button>
                </div>

              </div>
            ) : null}
          </div>
        </main>

        <footer className="flex-shrink-0 text-center text-xs border-t py-3 mt-4 sticky bottom-0 ">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>
              Built by{" "}
              <a
                href={URLS.TWITTER}
                className="text-green-500 hover:text-green-500/80 font-medium transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                @davidamunga
              </a>
            </p>
            <div className="flex items-center gap-3">
              {appVersion && <span className="">v{appVersion}</span>}
              <UpdateChecker showButton={true} iconOnly={true} />
              <ThemeToggle />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
