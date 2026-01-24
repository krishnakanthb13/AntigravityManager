# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2026-01-25

### Bug Fixes

- Fixed startup race condition causing cloud accounts verify failure ([f0718db]
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
