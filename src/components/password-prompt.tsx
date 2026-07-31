import React, { useEffect, useId, useRef, useState } from "react";
import { FileStatus } from "../types";
import { FileText, Lock, Shield } from "lucide-react";
import { cn } from "../lib/utils";
import { PasswordInput } from "./ui/password-input";
import { Button } from "./ui/button";

interface PasswordPromptProps {
  onPasswordSubmit: (password: string) => void;
  onSkip?: () => void;
  onReset?: () => void;
  status: FileStatus;
  /** True while the current file is being decrypted — keeps this UI mounted. */
  isUnlocking?: boolean;
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
  isUnlocking = false,
  error,
  currentFileName,
  currentFileIndex,
  totalFiles,
}) => {
  const [password, setPassword] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const isProcessing = isUnlocking || status === FileStatus.PROCESSING;
  const isBatch = (totalFiles ?? 0) > 1;
  const step = (currentFileIndex ?? 0) + 1;

  useEffect(() => {
    if (error) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [error]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      onPasswordSubmit(password);
    }
  };

  return (
    <div className="flex flex-1 flex-col justify-center gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Lock className="size-4 shrink-0" strokeWidth={1.75} />
              <h2 className="text-base font-semibold text-foreground">
                Password protected PDF
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {isBatch
                ? `File ${step} of ${totalFiles} — decrypts on this device only`
                : "Decrypts on this device only — nothing is uploaded"}
            </p>
          </div>
        </div>

        {currentFileName && (
          <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
            <FileText
              className="size-4 shrink-0 text-muted-foreground"
              strokeWidth={1.5}
            />
            <p
              className="min-w-0 truncate text-sm text-muted-foreground"
              title={currentFileName}
            >
              {currentFileName}
            </p>
          </div>
        )}
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="statement-password"
            className="text-sm font-medium text-foreground"
          >
            Password
          </label>
          <PasswordInput
            id="statement-password"
            ref={inputRef}
            className={cn(
              "h-10",
              error &&
                "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
            )}
            placeholder="Statement password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isProcessing}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : "password-hint"}
          />
          {error ? (
            <p id={errorId} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : (
            <p id="password-hint" className="text-xs text-muted-foreground">
              Often the OTP code used when requesting the statement or National ID (for old statements)
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={!password.trim() || isProcessing}
        >
          {isProcessing ? (
            <>
              <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Unlocking…
            </>
          ) : (
            "Unlock & process"
          )}
        </Button>

        {(onSkip || onReset) && (
          <div className="flex items-center justify-center gap-1">
            {onSkip && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={onSkip}
                disabled={isProcessing}
              >
                Skip file
              </Button>
            )}
            {onSkip && onReset && (
              <span
                aria-hidden
                className="text-muted-foreground/40 select-none"
              >
                ·
              </span>
            )}
            {onReset && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={onReset}
                disabled={isProcessing}
              >
                Start over
              </Button>
            )}
          </div>
        )}
      </form>

      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Shield className="size-3.5 shrink-0" strokeWidth={1.75} />
        <span>Password never leaves this device</span>
      </div>
    </div>
  );
};

export default PasswordPrompt;
