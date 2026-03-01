import React, { useState, useRef, ChangeEvent, useEffect } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { readFile } from "@tauri-apps/plugin-fs";
import { FileStatus } from "../types";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { FileUp, Shield } from "lucide-react";

interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void;
  status: FileStatus;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  onFilesSelected,
  status,
}) => {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set up Tauri webview drag-drop event listener
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupDragDropListener = async () => {
      try {
        const webview = getCurrentWebview();

        unlisten = await webview.onDragDropEvent((event) => {
          if (event.payload.type === "over") {
            setDragActive(true);
          } else if (event.payload.type === "drop") {
            setDragActive(false);
            handleTauriDrop(event.payload.paths);
          } else {
            setDragActive(false);
          }
        });
      } catch (error) {
        setupBrowserDragDrop();
      }
    };

    const setupBrowserDragDrop = () => {
      const preventDefaults = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
      };

      const events = ["dragenter", "dragover", "dragleave", "drop"];

      events.forEach((eventName) => {
        document.addEventListener(eventName, preventDefaults, false);
      });

      return () => {
        events.forEach((eventName) => {
          document.removeEventListener(eventName, preventDefaults, false);
        });
      };
    };

    setupDragDropListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const isPdfFile = (file: File): boolean => {
    if (file.type === "application/pdf") {
      return true;
    }

    const fileName = file.name.toLowerCase();
    return fileName.endsWith(".pdf");
  };

  const isPdfFilePath = (filePath: string): boolean => {
    return filePath.toLowerCase().endsWith(".pdf");
  };

  const handleTauriDrop = async (filePaths: string[]) => {
    setUploadError("");
    try {
      const pdfPaths = filePaths.filter(isPdfFilePath);

      if (pdfPaths.length === 0) {
        setUploadError("Please drop only PDF files.");
        return;
      }

      const files: File[] = [];

      for (const filePath of pdfPaths) {
        try {
          const fileContent = await readFile(filePath);

          const fileName = filePath.split(/[\\/]/).pop() || "unknown.pdf";

          const file = new File([fileContent], fileName, {
            type: "application/pdf",
          });
          files.push(file);
        } catch (error) {
          // Silently skip files that can't be read
        }
      }

      if (files.length > 0) {
        onFilesSelected(files);
        setUploadError("");
      } else {
        setUploadError(
          "Failed to read the dropped PDF files. Please try again."
        );
      }
    } catch (error) {
      setUploadError("Error processing dropped files. Please try again.");
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setUploadError("");
    if (e.target.files && e.target.files.length > 0) {
      const files: File[] = [];
      const allFiles = Array.from(e.target.files);

      for (const file of allFiles) {
        if (isPdfFile(file)) {
          files.push(file);
        }
      }

      if (files.length > 0) {
        onFilesSelected(files);
        setUploadError("");
      } else {
        setUploadError("Please select only PDF files.");
      }
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone */}
      <div
        className={cn(
          "relative rounded-xl transition-all duration-200 cursor-pointer overflow-hidden",
          dragActive
            ? "border-2 border-primary bg-primary/8 scale-[1.01]"
            : "border-2 border-dashed border-border hover:border-primary/60 hover:bg-muted/30"
        )}
        tabIndex={0}
        aria-label="Drop PDF files here or click to select files"
      >
        <div className="flex flex-col items-center justify-center gap-4 px-8 py-10 text-center">
          {/* Icon */}
          <div
            className={cn(
              "rounded-2xl p-4 transition-all duration-200",
              dragActive
                ? "bg-primary/15 text-primary scale-110"
                : "bg-muted/60 text-muted-foreground"
            )}
          >
            <FileUp
              className={cn(
                "w-8 h-8 transition-all duration-200",
                dragActive && "text-primary"
              )}
              strokeWidth={1.5}
            />
          </div>

          {/* Text */}
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold">
              {dragActive
                ? "Release to upload"
                : "Drop your M-PESA statement PDFs here"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {dragActive
                ? "Drop to start converting your statements"
                : "Supports single and multiple files — drag & drop or browse"}
            </p>
          </div>

          {/* CTA */}
          {!dragActive && (
            <Button
              type="button"
              onClick={handleButtonClick}
              size="default"
              className="px-6"
              disabled={
                status === FileStatus.LOADING || status === FileStatus.PROCESSING
              }
            >
              {status === FileStatus.LOADING ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                  Loading…
                </>
              ) : (
                "Browse PDF Files"
              )}
            </Button>
          )}
        </div>

        {/* Drag overlay shimmer */}
        {dragActive && (
          <div className="absolute inset-0 pointer-events-none rounded-xl ring-2 ring-primary ring-inset" />
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="application/pdf"
        onChange={handleFileChange}
        multiple
      />

      {/* Error */}
      {uploadError && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
          <p className="text-destructive text-sm">{uploadError}</p>
        </div>
      )}

      {/* Privacy note */}
      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Shield className="w-3.5 h-3.5 shrink-0" />
        <span>100% local — your files never leave your device</span>
      </div>
    </div>
  );
};

export default FileUploader;
