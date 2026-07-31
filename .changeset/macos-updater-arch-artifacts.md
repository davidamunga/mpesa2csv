---
"mpesa2csv": patch
---

Fix macOS auto-updates failing on Apple Silicon by publishing separate aarch64 and x86_64 updater archives, and pointing `latest.json` at the matching artifact for each architecture.
