import React, { useState } from "react";
import { FileStatus } from "../types";
import { Lock, Shield } from "lucide-react";
import { cn } from "../lib/utils";
import { PasswordInput } from "./ui/password-input";
import { Button } from "./ui/button";

interface PasswordPromptProps {
  onPasswordSubmit: (password: string) => void;
  onSkip?: () => void;
  onReset?: () => void;
  status: FileStatus;
  error?: string;
  currentFileName?: string;
  currentFileIndex?: number;
  totalFiles?: number;
}

const PasswordPrompt: React.FC<PasswordPromptProps> = ({
  onPasswordSubmit,
  onSkip,
  onReset,
  status,
  error,
  currentFileName,
  currentFileIndex,
  totalFiles,
}) => {
  const [password, setPassword] = useState<string>("");
  const isProcessing = status === FileStatus.PROCESSING;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      onPasswordSubmit(password);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="rounded-2xl bg-muted/60 p-4 text-yellow-500">
          <Lock className="size-8" strokeWidth={1.5} />
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-semibold">Password protected PDF</h3>
          {totalFiles && totalFiles > 1 ? (
            <p className="text-sm text-muted-foreground">
              File {(currentFileIndex ?? 0) + 1} of {totalFiles}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Enter the password to unlock and process this file
            </p>
          )}
        </div>

        {currentFileName && (
          <span className="inline-block max-w-xs truncate rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
            {currentFileName}
          </span>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <PasswordInput
            className={cn(
              error
                ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
                : ""
            )}
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isProcessing}
            autoFocus
          />
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={!password.trim() || isProcessing}
        >
          {isProcessing ? (
            <>
              <div className="animate-spin h-4 w-4 border-b-2 border-current rounded-full" />
              Unlocking…
            </>
          ) : (
            "Unlock PDF"
          )}
        </Button>

        {(onSkip || onReset) && (
          <div className="flex gap-2">
            {onSkip && (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onSkip}
                disabled={isProcessing}
              >
                Skip File
              </Button>
            )}
            {onReset && (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onReset}
                disabled={isProcessing}
              >
                Restart
              </Button>
            )}
          </div>
        )}
      </form>

      {/* Privacy note */}
      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Shield className="w-3.5 h-3.5 shrink-0" />
        <span>Password is only used locally to decrypt the file</span>
      </div>
    </div>
  );
};

export default PasswordPrompt;
