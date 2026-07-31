---
"mpesa2csv": patch
---

Resolve the `brace-expansion` DoS advisory (GHSA-mh99-v99m-4gvg) by overriding the transitive exceljs dependency to a patched release so CI security audits pass.
