# mpesa2csv

## 1.2.0

### Minor Changes

- [#80](https://github.com/davidamunga/mpesa2csv/pull/80) [`f2bee2b`](https://github.com/davidamunga/mpesa2csv/commit/f2bee2b1caa0a71bb9ca0eb1b7eb823ae113411b) Thanks [@davidamunga](https://github.com/davidamunga)! - Add optional Day-of-Week Activity Excel analysis sheet.

## 1.1.0

### Minor Changes

- [#78](https://github.com/davidamunga/mpesa2csv/pull/78) [`3a6825a`](https://github.com/davidamunga/mpesa2csv/commit/3a6825a03e96ba02aa4c43f3a4a339ba1eb7cb63) - Add optional Pay Bills & Tills Excel sheet with shortcode and account rollups.

- [#77](https://github.com/davidamunga/mpesa2csv/pull/77) [`a2286d0`](https://github.com/davidamunga/mpesa2csv/commit/a2286d0a591d4e6b6a0d05e29d832856a8921826) - Add optional Reversals Excel sheet and fix multiline Tabula CSV parsing.

## 1.0.2

### Patch Changes

- Fix password-protected PDFs failing with an empty Tabula error instead of showing the unlock prompt, by capturing Java stderr/stdout and improving password-error detection and the protected-file UI. ([#74](https://github.com/davidamunga/mpesa2csv/pull/74))

## 1.0.1

### Patch Changes

- Resolve the `brace-expansion` DoS advisory (GHSA-mh99-v99m-4gvg) by overriding the transitive exceljs dependency to a patched release so CI security audits pass. ([#72](https://github.com/davidamunga/mpesa2csv/pull/72))

- Fix macOS auto-updates failing on Apple Silicon by publishing separate aarch64 and x86_64 updater archives, and pointing `latest.json` at the matching artifact for each architecture. ([#72](https://github.com/davidamunga/mpesa2csv/pull/72))

## 1.0.0

### Major Changes

- Success screen now shows a financial snapshot — date range covered, total money in, total money out, and charges — all derived from the parsed statement before you export. Window height reduced from 850 → 650px, footer simplified to a single line, and dead-zone layout issues resolved. ([#70](https://github.com/davidamunga/mpesa2csv/pull/70))

### Patch Changes

- Reduce initial JS bundle from 1 466 kB to 487 kB (−67%) by removing 10 unused packages, lazy-loading ExcelJS via dynamic import ([#69](https://github.com/davidamunga/mpesa2csv/pull/69))

- improved success state ui ([#70](https://github.com/davidamunga/mpesa2csv/pull/70))

## 0.14.0

### Minor Changes

- - Clickable drop zone ([#67](https://github.com/davidamunga/mpesa2csv/pull/67))
- Cancel button during processing
- Transaction preview before export
- Re-export without Start Again
- XLSX blob only on Export click
- Visible webhook result badge.

### Patch Changes

- Fix analytics sheets ignoring active export filters (e.g. exclude charges, sort order). ([#65](https://github.com/davidamunga/mpesa2csv/pull/65))

- Fix multi-file batch losing already-processed statements when a mid-batch file requires a password. ([#65](https://github.com/davidamunga/mpesa2csv/pull/65))

- fix : dependencies security ([#66](https://github.com/davidamunga/mpesa2csv/pull/66))

- Treat a parsed PDF with zero transactions as an error instead of showing a silent success screen. ([#65](https://github.com/davidamunga/mpesa2csv/pull/65))

- Kill the Java/Tabula process when PDF extraction times out instead of leaving it running in the background. ([#65](https://github.com/davidamunga/mpesa2csv/pull/65))

## 0.13.0

### Minor Changes

- feat: add recurring transactions export sheet ([`8436074`](https://github.com/davidamunga/mpesa2csv/commit/84360748c8636025407f4fe32cc805b4d1ffed3f))

- feat: add time of day export sheet ([`8436074`](https://github.com/davidamunga/mpesa2csv/commit/84360748c8636025407f4fe32cc805b4d1ffed3f))

- feat: updated ui components ([`8436074`](https://github.com/davidamunga/mpesa2csv/commit/84360748c8636025407f4fe32cc805b4d1ffed3f))

## 0.12.4

### Patch Changes

- fix: os build release fixes ([`c5c2765`](https://github.com/davidamunga/mpesa2csv/commit/c5c2765906d794bfbbf71c10484a4d466e703f9a))

## 0.12.1

### Patch Changes

- fix: intel mac build ([`1c8dd71`](https://github.com/davidamunga/mpesa2csv/commit/1c8dd71dfb0b603c0f4af2ca946ed73759ff7cac))

## 0.12.0

### Minor Changes

- feat: add total charges in header summary ([#59](https://github.com/DavidAmunga/mpesa2csv/pull/59))

## 0.11.4

### Patch Changes

- fix: windows build-jre folder path ([`c7be488`](https://github.com/DavidAmunga/mpesa2csv/commit/c7be4883974d76f33415e93ccb7daa05b54348fd))

## 0.11.3

### Patch Changes

- fix: windows jre folder bundling ([`fa44fa8`](https://github.com/DavidAmunga/mpesa2csv/commit/fa44fa8d8d14de521626244d4f13a1a1aa1769dd))

## 0.11.2

### Patch Changes

- revert:windows installers compression ([`2053a87`](https://github.com/DavidAmunga/mpesa2csv/commit/2053a8725c43a4fcd23ef5cb1e370dc8ceab20ea))

## 0.11.1

### Patch Changes

- fix: improve JRE bundling verification for Windows and macOS installers ([`46ea850`](https://github.com/DavidAmunga/mpesa2csv/commit/46ea8502c794ce635ad6a7b988245a6ccfbda068))

## 0.11.0

### Minor Changes

- 06804b8: feat: add money in/out sheets

## 0.10.2

### Patch Changes

- 339b23a: fix: macos jre bundling

## 0.10.1

### Patch Changes

- 0f3a4b6: fix: arm64 jre bundling

## 0.10.0

### Minor Changes

- 8d99064: feat: add webhook service for external integrations
- 68f7ad4: feat: add top contacts sheet

### Patch Changes

- 16d176f: chore: improve release workflow

## 0.9.0

### Minor Changes

- 68f7ad4: feat: add top contacts sheet

## 0.8.0

### Minor Changes

- 619f6e7: feat: added extra export formats

- JSON Export - Exports transactions in JSON format
- OFX Export - Exports transactions in OFX (Open Financial Exchange) format (Experimental)
- QFX Export - Exports transactions in QFX (Quicken Financial) format (Experimental)
- QIF Export - Exports transactions in QIF (Quicken Interchange) format (Experimental)

## 0.7.5

### Patch Changes

- fix: improve sheets stacking

## 0.7.4

### Patch Changes

- fix: improve release process updates

## 0.7.3

### Patch Changes

- e834026: Enable code signing for secure auto-updates

## 0.7.2

### Patch Changes

- fix: release process update

## 0.7.1

### Patch Changes

- 40276c7: feat: improve data parsing in tabulaService

## 0.7.0

### Minor Changes

- 97d245d: feat: Replace PDF.js with Tabula for improved PDF table extraction

## 0.6.1

### Patch Changes

- fix: updater checker

## 0.6.0

### Minor Changes

- feat: added date formatter to filter options
- fix: save file dialog not working on windows

## 0.5.5

### Patch Changes

- 307a7b2: fix: minor app improvements

## 0.5.4

### Patch Changes

- 9497a3a: fix: datetime parsing for paybill statements

## 0.5.3

### Patch Changes

- fix: android release

## 0.5.2

### Patch Changes

- fix: android release

## 0.5.1

### Patch Changes

- fix: android release

## 0.5.0

### Minor Changes

- c409480: feat: added android base setup
- c409480: feat: add transaction filters
- c409480: feat: add open file on download success button

## 0.4.0

### Minor Changes

- 3ae00d9: feat: Add Transaction Amount Distribution Sheet

### Patch Changes

- 3ae00d9: fix: reset/skip options after upload

## 0.3.0

### Minor Changes

- 43a16f2: feat: add daily balance tracker sheet
- 43a16f2: feat: add monthly & weekly breakdown sheet

## 0.2.0

### Minor Changes

- 3b58f9c: feat: added financial summary export

### Patch Changes

- df51aea: fix: reorder columns and update total charges display in xlsx charges sheet export
- 3b58f9c: fix: refine statement processing

## 0.1.0

### Minor Changes

- 68e265d: Add optional Charges/Fees sheet to Excel exports

- Add new export option to include a separate "Charges & Fees" sheet when exporting to Excel
- Filter and categorize all transactions containing "charge" in the details
- Display charges with date, amount, and balance information
- Include summary totals for total charges and number of charge transactions

## 0.0.3

### Patch Changes

- aaf57ba: - feat: Add Excel export support and format selection UI
- 4819fd1: fix: consistent ui styling and accessibility

## 0.0.2

### Patch Changes

- 3415c7a: feat: add theme support
