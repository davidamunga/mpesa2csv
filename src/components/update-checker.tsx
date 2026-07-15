import { useEffect, useState, useCallback } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { ask, message } from "@tauri-apps/plugin-dialog";
import { RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import { URLS } from "../constants";

const dismissedVersions = new Set<string>();

interface UpdateCheckerProps {
  autoCheck?: boolean;
  showButton?: boolean;
  iconOnly?: boolean;
}

export function UpdateChecker({
  autoCheck = false,
  showButton = false,
  iconOnly = false,
}: UpdateCheckerProps) {
  const [isChecking, setIsChecking] = useState(false);

  const extractVersionChanges = (notes: string, version: string): string => {
    const lines = notes.split("\n");
    const escapedVersion = version.replace(/\./g, "\\.");

    const versionPatterns = [
      new RegExp(
        `^##\\s*\\[v?${escapedVersion}\\](?:\\([^)]*\\))?(?:\\s*-\\s*\\d{4}-\\d{2}-\\d{2})?`,
        "i"
      ),
      new RegExp(`^##\\s*v?${escapedVersion}(?:\\s|$)`, "i"),
      new RegExp(`^##\\s*Version\\s+v?${escapedVersion}(?:\\s|$)`, "i"),
    ];

    let startIndex = -1;
    let endIndex = lines.length;

    for (let i = 0; i < lines.length; i++) {
      if (versionPatterns.some((pattern) => pattern.test(lines[i]))) {
        startIndex = i + 1;
        break;
      }
    }

    if (startIndex !== -1) {
      for (let i = startIndex; i < lines.length; i++) {
        if (/^##\s+/.test(lines[i])) {
          endIndex = i;
          break;
        }
      }

      const versionChanges = lines
        .slice(startIndex, endIndex)
        .join("\n")
        .trim();

      if (versionChanges) {
        return formatReleaseNotes(versionChanges);
      }
    }

    return formatReleaseNotes(notes);
  };

  const formatReleaseNotes = (notes: string): string => {
    return notes
      .split("\n")
      .map((line) => {
        if (line.match(/^###\s+(.+)/)) {
          return line.replace(/^###\s+/, "").toUpperCase() + ":";
        }
        if (line.match(/^[-*]\s+/)) {
          return line;
        }
        return line;
      })
      .join("\n")
      .replace(/\*\*(.*?)\*\*/g, "$1") // Remove bold
      .replace(/\*(.*?)\*/g, "$1") // Remove italic
      .replace(/`(.*?)`/g, "$1") // Remove code formatting
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Remove links but keep text
      .trim();
  };

  const installUpdate = useCallback(async (update: any) => {
    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch (error) {
      // Log error for debugging purposes
      if (error instanceof Error) {
        console.error("Update installation failed:", error.message);
      }
      await message(
        "Failed to download and install the update. Please try again later.",
        {
          title: "Update Failed",
          kind: "error",
        }
      );
    }
  }, []);

  const checkForUpdates = useCallback(
    async (forceShow: boolean = true) => {
      try {
        setIsChecking(true);
        const update = await check();

        if (update) {
          if (!forceShow && dismissedVersions.has(update.version)) {
            // Update already dismissed in this session
            return;
          }

          let releaseNotes = "No release notes available.";
          try {
            const response = await fetch(URLS.CHANGELOG);
            if (response.ok) {
              const changelogText = await response.text();
              if (changelogText && changelogText.trim()) {
                releaseNotes = changelogText;
              }
            }
          } catch (apiError) {
            // Failed to fetch changelog, fallback to update body if available
            if (update.body) {
              releaseNotes = update.body;
            }
          }

          const formattedNotes = extractVersionChanges(
            releaseNotes,
            update.version
          );
          const dialogMessage = `A new version ${update.version} is available!\n\nWhat's New:\n${formattedNotes}\n\nWould you like to download and install it now? The app will restart automatically.`;

          const shouldUpdate = await ask(dialogMessage, {
            title: "Update Available",
            kind: "info",
            okLabel: "Update Now",
            cancelLabel: "Later",
          });

          if (shouldUpdate) {
            await installUpdate(update);
          } else {
            dismissedVersions.add(update.version);
            // Update dismissed until app relaunch
          }
        } else if (forceShow) {
          await message("You're running the latest version!", {
            title: "No Updates Available",
            kind: "info",
          });
        }
      } catch (error) {
        // Log error for debugging purposes
        if (error instanceof Error) {
          console.error("Update check failed:", error.message);
        }
        if (forceShow) {
          await message(
            "Failed to check for updates. Please try again later.",
            {
              title: "Update Check Failed",
              kind: "error",
            }
          );
        }
      } finally {
        setIsChecking(false);
      }
    },
    [installUpdate]
  );

  useEffect(() => {
    if (autoCheck) {
      checkForUpdates(false);
    }
  }, [autoCheck, checkForUpdates]);

  if (showButton && iconOnly) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              onClick={() => checkForUpdates(true)}
              disabled={isChecking}
              className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              aria-label="Check for updates"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? "animate-spin" : ""}`} />
            </button>
          }
        />
        <TooltipContent side="top">
          <p>{isChecking ? "Checking for updates…" : "Check for updates"}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (showButton) {
    return (
      <Button
        onClick={() => checkForUpdates(true)}
        disabled={isChecking}
        variant="ghost"
        size="sm"
        className="text-xs hover:bg-transparent hover:text-primary"
      >
        {isChecking ? (
          <>
            <RefreshCw className="w-3 h-3 animate-spin" />
            Checking...
          </>
        ) : (
          <>
            <RefreshCw className="w-3 h-3" />
            Check for Updates
          </>
        )}
      </Button>
    );
  }

  return null;
}
