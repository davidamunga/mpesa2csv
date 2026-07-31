---
"mpesa2csv": patch
---

Fix password-protected PDFs failing with an empty Tabula error instead of showing the unlock prompt, by capturing Java stderr/stdout and improving password-error detection and the protected-file UI.
