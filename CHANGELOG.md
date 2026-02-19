<a name="readme-top"></a>

# Changelog

## [0.10.0](https://github.com/Draculabo/AntigravityManager/compare/v0.9.2...v0.10.0) (2026-02-19)

### ✨ Features

* Add powerful CLI for account management ([#115](https://github.com/Draculabo/AntigravityManager/issues/115)) ([b949764](https://github.com/Draculabo/AntigravityManager/commit/b9497648c6a7f50dd9b05a7f3d54ac95fa373349))
* Implement provider groupings with account calculator and compre… ([#113](https://github.com/Draculabo/AntigravityManager/issues/113)) ([1e59a1c](https://github.com/Draculabo/AntigravityManager/commit/1e59a1c901d5feedb1089015060fc8c31b614d4d))

### 🐛 Bug Fixes

* refactor layout containers for proxy and settings pages to ensure full height and unified scrolling ([#102](https://github.com/Draculabo/AntigravityManager/issues/102)) ([caaaaf5](https://github.com/Draculabo/AntigravityManager/commit/caaaaf571864aeb2bd68dc271972fd197c999bd1))
* **statusbar:** reduce process polling from 2s to 10s to prevent heap corruption crash ([#110](https://github.com/Draculabo/AntigravityManager/issues/110)) ([118fad5](https://github.com/Draculabo/AntigravityManager/commit/118fad567eeaac4e173b97d3eeb84e1f3edd4556))

## [0.9.2](https://github.com/Draculabo/AntigravityManager/compare/v0.9.1...v0.9.2) (2026-02-11)

### 🐛 Bug Fixes

* project id fallback and stream error regression ([#94](https://github.com/Draculabo/AntigravityManager/issues/94)) ([caf9d58](https://github.com/Draculabo/AntigravityManager/commit/caf9d5849ac86f4c83cb7b33804b873e0c2ff545))

## [0.9.1](https://github.com/Draculabo/AntigravityManager/compare/v0.9.0...v0.9.1) (2026-02-11)

### 🐛 Bug Fixes

* project id forwarding regression ([#93](https://github.com/Draculabo/AntigravityManager/issues/93)) ([ab78d93](https://github.com/Draculabo/AntigravityManager/commit/ab78d9325213623067b5bd867b35464cd4eefd73))

## [0.9.0](https://github.com/Draculabo/AntigravityManager/compare/v0.8.0...v0.9.0) (2026-02-10)

### ✨ Features

* add vercel and ui skills ([#86](https://github.com/Draculabo/AntigravityManager/issues/86)) ([0f7a629](https://github.com/Draculabo/AntigravityManager/commit/0f7a629a4794b5e340371c8d6614c36d14b5ef43))
* global error fallback and e2e ([#91](https://github.com/Draculabo/AntigravityManager/issues/91)) ([b89dd2c](https://github.com/Draculabo/AntigravityManager/commit/b89dd2c3bbb8ae1617cec511960c934c260abc7c))
* implement protocol parity and harden upstream handling ([#88](https://github.com/Draculabo/AntigravityManager/issues/88)) ([13f10fe](https://github.com/Draculabo/AntigravityManager/commit/13f10fe32f73306470a50b0284c8026117b65695))

### 🐛 Bug Fixes

* prevent page crash on 500 and add toast-based fallback ([#90](https://github.com/Draculabo/AntigravityManager/issues/90)) ([bcca5ec](https://github.com/Draculabo/AntigravityManager/commit/bcca5ec9351cef6b1cda708777459055a0bc1a0c))
* prevent sensitive data logging ([#70](https://github.com/Draculabo/AntigravityManager/issues/70)) ([5155e37](https://github.com/Draculabo/AntigravityManager/commit/5155e37fd1ceb4bc72f121fbc9ca53e6b12ce646))

### 📝 Documentation

* upgrade openspec workflow ([#85](https://github.com/Draculabo/AntigravityManager/issues/85)) ([e4584d0](https://github.com/Draculabo/AntigravityManager/commit/e4584d0bc4627054cc2d2b07f998e9f61614e88c))

### 🔧 Continuous Integration

* fix publish workflow release tag resolution ([#82](https://github.com/Draculabo/AntigravityManager/issues/82)) ([5613709](https://github.com/Draculabo/AntigravityManager/commit/56137092beab315843d401e17a3edd456d38ba87))
* remove darwin universal build from publish workflow ([#81](https://github.com/Draculabo/AntigravityManager/issues/81)) ([5b93ca8](https://github.com/Draculabo/AntigravityManager/commit/5b93ca889108ac354e6c9a84f01149f4653ed7c6))
* split publish into build and gated release with dry-run ([#80](https://github.com/Draculabo/AntigravityManager/issues/80)) ([3eaf927](https://github.com/Draculabo/AntigravityManager/commit/3eaf9278ae2ef0103efaeed7a0ebdc77a4961025))

## [0.8.0](https://github.com/Draculabo/AntigravityManager/compare/v0.7.0...v0.8.0) (2026-02-07)

### ✨ Features

* complete account-bound profile switching and hardening ([#78](https://github.com/Draculabo/AntigravityManager/issues/78)) ([a93c6d0](https://github.com/Draculabo/AntigravityManager/commit/a93c6d0cea5b9904a30234faffe767505f753373))

### 🐛 Bug Fixes

* **ci:** increase Node heap for publish step to prevent macOS OOM ([#76](https://github.com/Draculabo/AntigravityManager/issues/76)) ([ee64179](https://github.com/Draculabo/AntigravityManager/commit/ee641799c27425ceb6d2d6d00a132881bedb1f04))
* **ci:** make WiX Toolset setup resilient on Windows runners ([#73](https://github.com/Draculabo/AntigravityManager/issues/73)) ([5fe434f](https://github.com/Draculabo/AntigravityManager/commit/5fe434f7050cb8975d65502baeb03b1747e00611))

### 📝 Documentation

* **openspec:** backfill missing proposals ([287e848](https://github.com/Draculabo/AntigravityManager/commit/287e848b3291d2ee43b173802b87491c2a90930d))

## [0.7.0](https://github.com/Draculabo/AntigravityManager/compare/v0.6.0...v0.7.0) (2026-02-06)

### ✨ Features

* add multi-arch release artifacts and MSI packaging ([#65](https://github.com/Draculabo/AntigravityManager/issues/65)) ([f572ae4](https://github.com/Draculabo/AntigravityManager/commit/f572ae4652937efb25ab66defcfa55ddf65ac484))

### 🐛 Bug Fixes

* restore account switching on Antigravity 1.16.5 and migrate db sync to drizzle ([#69](https://github.com/Draculabo/AntigravityManager/issues/69)) ([ed94abf](https://github.com/Draculabo/AntigravityManager/commit/ed94abf0d6e90c0a1bf9c76f1ec3fdea091f6c4b))

### 📝 Documentation

* translate repository documentation to English ([#72](https://github.com/Draculabo/AntigravityManager/issues/72)) ([18389b9](https://github.com/Draculabo/AntigravityManager/commit/18389b975392f63441ede8369f13f6ef068214ab))

### ♻️ Code Refactoring

* migrate to winston and enable daily rotated app logs ([#71](https://github.com/Draculabo/AntigravityManager/issues/71)) ([2ae2216](https://github.com/Draculabo/AntigravityManager/commit/2ae2216f1ed3fa503ffd87a14cafd3921077a5c4))

## [0.6.0](https://github.com/Draculabo/AntigravityManager/compare/v0.5.0...v0.6.0) (2026-02-04)

### ✨ Features

*  add cloud reset time UI ([#56](https://github.com/Draculabo/AntigravityManager/issues/56)) ([f6f8069](https://github.com/Draculabo/AntigravityManager/commit/f6f8069ce4673ae7027c6ba248daa18c8b602218))
* windows install guidance ([#63](https://github.com/Draculabo/AntigravityManager/issues/63)) ([ce71470](https://github.com/Draculabo/AntigravityManager/commit/ce7147025d37648a82f6f6b300502ef4462bfde6))

### 🐛 Bug Fixes

* correct Windows install notice path ([5bda4b1](https://github.com/Draculabo/AntigravityManager/commit/5bda4b19dfc9ce64735cd39600d41a5deefc26ee))
* **proxy:** route Claude Code CLI requests on /v1/chat/completions to Anthropic handler ([#61](https://github.com/Draculabo/AntigravityManager/issues/61)) ([476d297](https://github.com/Draculabo/AntigravityManager/commit/476d297e4b2dd3015f7ebcbb915b643730816dc6))

## [0.5.0](https://github.com/Draculabo/AntigravityManager/compare/v0.4.0...v0.5.0) (2026-01-30)

### ✨ Features

* **i18n:** add Russian localization ([#48](https://github.com/Draculabo/AntigravityManager/issues/48)) ([63956c9](https://github.com/Draculabo/AntigravityManager/commit/63956c9c2d60f829a998237abe6ade675fdb01ed))
* Implement collapsible sidebar and refined status bar UI ([#45](https://github.com/Draculabo/AntigravityManager/issues/45)) ([1265d04](https://github.com/Draculabo/AntigravityManager/commit/1265d044f69e52fba7da72fde6c47a0b85c58232))
* sentry integration ([#51](https://github.com/Draculabo/AntigravityManager/issues/51)) ([a785640](https://github.com/Draculabo/AntigravityManager/commit/a785640d7a51b65a6852383401bd7c284b716975))

## [0.4.0](https://github.com/Draculabo/AntigravityManager/compare/v0.3.5...v0.4.0) (2026-01-28)

### ✨ Features

* add system autostart and single-instance support ([ea51253](https://github.com/Draculabo/AntigravityManager/commit/ea51253d589abd537682344d3bdb684b8fc9a511))
* implement smart foreground quota refresh with debounce ([dd9e84a](https://github.com/Draculabo/AntigravityManager/commit/dd9e84a0dbefad6066193b6bd468689a755a02e3))

### 🐛 Bug Fixes

* stub nestjs optional modules for packaging ([f0eb7c6](https://github.com/Draculabo/AntigravityManager/commit/f0eb7c6b619a3ea9ea203d66f5dbce731d731e3c))

## [0.3.5](https://github.com/Draculabo/AntigravityManager/compare/v0.3.4...v0.3.5) (2026-01-26)

### 🐛 Bug Fixes

- "Check Quota Now" button not refreshing UI after polling ([#42](https://github.com/Draculabo/AntigravityManager/issues/42)) ([e959ee3](https://github.com/Draculabo/AntigravityManager/commit/e959ee346e7c26a8a4c5b7deefa5bd2452153f9d))

### 📝 Documentation

- remove beta download links from README ([5a21680](https://github.com/Draculabo/AntigravityManager/commit/5a2168030eac4ddeffa1c3b002b2de48b6a11a8f))

## [0.3.4](https://github.com/Draculabo/AntigravityManager/compare/v0.3.3...v0.3.4) (2026-01-26)

### 🐛 Bug Fixes

- **security:** add safeStorage fallback for production builds ([#38](https://github.com/Draculabo/AntigravityManager/issues/38)) ([#43](https://github.com/Draculabo/AntigravityManager/issues/43)) ([0208058](https://github.com/Draculabo/AntigravityManager/commit/02080588b764ed88a5831152a3a1249f1d077d29))

### 📝 Documentation

- update beta release link ([d5ee08d](https://github.com/Draculabo/AntigravityManager/commit/d5ee08d5a06a915a8b82f680b38e2f532105498c))

## [0.3.4-beta.1](https://github.com/Draculabo/AntigravityManager/compare/v0.3.3...v0.3.4-beta.1) (2026-01-25)

### 🐛 Bug Fixes

- **security:** add safeStorage fallback for production builds ([#38](https://github.com/Draculabo/AntigravityManager/issues/38)) ([92dc2f6](https://github.com/Draculabo/AntigravityManager/commit/92dc2f6f2169eb1a32950694387f2333ea2de682))

## [0.3.3](https://github.com/Draculabo/AntigravityManager/compare/v0.3.2...v0.3.3) (2026-01-25)

### 🐛 Bug Fixes

- accept lowercase antigravity in process detection ([0d4e2ab](https://github.com/Draculabo/AntigravityManager/commit/0d4e2ab21f37704e09ef1a67c181c48b42df1180))

### 📝 Documentation

- add beta download link to readme ([f15bb48](https://github.com/Draculabo/AntigravityManager/commit/f15bb48fdda10fda3c2382941ee0ce51204f750a))
- clean up changelog duplicate ([22265e1](https://github.com/Draculabo/AntigravityManager/commit/22265e153c9d394229aa48afdc5948044b74e842))

## [0.3.2](https://github.com/Draculabo/AntigravityManager/compare/v0.3.1...v0.3.2) (2026-01-25)

### 🐛 Bug Fixes

- handle keychain hint and suppress pgrep spam ([bd3d41a](https://github.com/Draculabo/AntigravityManager/commit/bd3d41aed17bafe9d684c5c421bad8b90afa19a8))

### 📝 Documentation

- add macOS self-signing workaround for Keychain issues ([01e3f8f](https://github.com/Draculabo/AntigravityManager/commit/01e3f8f8fd6dacc5eed214ed4b505d6d85f4bcff))

### 🔧 Continuous Integration

- setup semantic release configuration and github actions workflow ([d2945a6](https://github.com/Draculabo/AntigravityManager/commit/d2945a6e8a14d75f577716183cdff093443d9636))
- trigger publish on release published event ([6a07bc0](https://github.com/Draculabo/AntigravityManager/commit/6a07bc0a10a5ad802777e007cfd7390852119b15))

## [0.3.1] - 2026-01-25

### Bug Fixes

- Fixed startup race condition causing cloud accounts verify failure ([f0718db])
- Enabled WAL mode and force initialization on startup to resolve process resource contention ([1bce5d3])

## [0.3.0] - 2026-01-23

### New Features

- Verify Google OAuth code automatically after receipt
- Add button to open logs folder
- Add expiration warning for Google OAuth authentication

### Bug Fixes

- Fixed `state.vscdb` path on Linux to include `User/globalStorage` subdirectory (Fixed [#26](https://github.com/Draculabo/AntigravityManager/issues/26))
- Improved process detection on macOS/Linux using `find-process` to reliably identify the main application and exclude helper processes (Fixed [#27](https://github.com/Draculabo/AntigravityManager/issues/27))
- Fixed keychain access error on macOS Apple Silicon (M1/M2/M3) by adding arm64 build to CI

### Maintenance

- Add VS Code settings for auto-formatting and ESLint

## [0.2.2] - 2026-01-19

### Bug Fixes

- Fixed tray icon not appearing in production builds on Windows
  - Used `extraResource` config to properly copy assets outside of ASAR package
  - Added debug logging for tray icon path resolution

## [0.2.1] - 2026-01-19

### Bug Fixes

- Fixed process detection to be case-insensitive on Linux/macOS (`pgrep -xi`) ([#24](https://github.com/Draculabo/AntigravityManager/pull/24)) - Thanks [@Olbrasoft](https://github.com/Olbrasoft)!
- Fixed manager exclusion logic to prevent accidental self-termination ([#24](https://github.com/Draculabo/AntigravityManager/pull/24))
- Fixed zombie tray icons on application restart/hot reload ([#24](https://github.com/Draculabo/AntigravityManager/pull/24))

### Maintenance

- Applied Prettier formatting to entire codebase (68 files)
- Added node globals to ESLint configuration

## [0.2.0] - 2026-01-16

### New Features

- Enhanced cloudHandler to inject minimal auth state when database entry is missing, improving onboarding reliability.
- Implemented stability fixes and enhanced error handling across the application.

### Improvements

- Upgraded Electron from 32.3.3 to 37.3.1 for improved performance and security.
- Conditionally include plugins based on start command in forge.config.ts for better build flexibility.

### Bug Fixes

- Fixed "Converting circular structure to JSON" error.

### Documentation

- Added curly brace constraints for conditional statements.
- Fixed incorrect reference documentation name.

## [0.1.1] - 2026-01-11

### Bug Fixes

- Fix Antigravity visibility issue on account switch. (Fixed [#19](https://github.com/Draculabo/AntigravityManager/issues/19))

## [0.1.0] - 2026-01-10

### New Features

- LAN Connection Support: Users can now connect via Local Area Network (LAN) for improved flexibility and internal environment support.
- Antigravity Integration: Added native support and adaptation for Antigravity, enhancing overall compatibility.
- Local API Proxy: Built-in OpenAI/Anthropic compatible proxy server.

### Bug Fixes

- Reverse Proxy Issue: Resolved a critical error occurring during reverse proxy configurations. (Fixed [#11](https://github.com/Draculabo/AntigravityManager/issues/11))

## [0.0.1] - 2025-12-22

### Added

- Initial release of Antigravity Manager
- Multi-account management for Google Gemini and Claude
- Real-time quota monitoring
- Intelligent auto-switching capabilities
- Secure credential storage (AES-256-GCM)
- IDE synchronization
- Dark mode support
- System tray integration
