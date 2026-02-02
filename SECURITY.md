# Security Policy

## 🔒 Security Features

Antigravity Manager takes security seriously. Here are the security measures we've implemented:

### Encryption

- **AES-256-GCM** encryption for all sensitive data (`token_json`, `quota_json`)
- Unique initialization vectors (IV) for each encryption operation
- Authenticated encryption to prevent tampering

### Credential Storage

- **Windows**: Windows Credential Manager
- **macOS**: macOS Keychain
- **Linux**: Secret Service API / libsecret

Master keys are stored in the OS native credential manager via `keytar`, never in plain text files.

### Data Protection

- Sensitive tokens are encrypted before storage in SQLite database
- Automatic migration of legacy plaintext data on application startup
- No sensitive data is logged or transmitted to external services

## 📋 Supported Versions

| Version  | Supported          |
| -------- | ------------------ |
| Latest   | :white_check_mark: |
| < Latest | :x:                |

We only provide security updates for the latest version. Please ensure you're running the most recent release.

## 🚨 Reporting a Vulnerability

We take all security vulnerabilities seriously. Thank you for helping to improve the security of Antigravity Manager.

### How to Report

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via one of the following methods:

1. **GitHub Security Advisories**: Use our [private vulnerability reporting](https://github.com/Draculabo/AntigravityManager/security/advisories/new)
2. **Email**: Send details to the project maintainer (see GitHub profile for contact)

### What to Include

Please include the following information in your report:

- Type of vulnerability (e.g., buffer overflow, SQL injection, XSS)
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue and how an attacker might exploit it

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 5 business days
- **Resolution Timeline**: Depends on complexity, typically within 30 days

### What to Expect

1. **Acknowledgment**: We'll confirm receipt of your report
2. **Investigation**: We'll investigate and validate the vulnerability
3. **Fix Development**: We'll develop and test a fix
4. **Disclosure**: We'll coordinate disclosure timing with you
5. **Credit**: With your permission, we'll credit you in the release notes

## 🛡️ Security Best Practices for Users

To ensure the security of your data:

1. **Keep Updated**: Always use the latest version of Antigravity Manager
2. **System Security**: Keep your operating system updated
3. **Secure Environment**: Use the application on trusted devices only
4. **Backup**: Regularly backup your account data using the built-in backup feature
5. **Review Permissions**: Only grant necessary OAuth permissions

## 📜 Disclosure Policy

When we receive a security bug report, we will:

1. Confirm the problem and determine affected versions
2. Audit code to find any similar problems
3. Prepare fixes for all supported versions
4. Release new versions as soon as possible

## 🛡️ Security Audit Log

| Date | Auditor | Scope | Findings | Status |
| :--- | :--- | :--- | :--- | :--- |
| 2026-02-02 | Antigravity AI | Full Codebase Sweep | 7 Production Vulnerabilities (NPM Audit), Safe Auth/SQL Patterns | 🟡 Warning |

### Detailed Findings (2026-02-02)

#### 🟢 Passed
- **SQL Injection**: All SQLite operations use parameterized queries/prepared statements.
- **Secrets Detection**: No hardcoded API keys or secrets found in the source.
- **Data Protection**: AES-256-GCM implemented correctly for sensitive storage.
- **XSS/RCE**: No usage of `innerHTML`, `eval()`, or `new Function()` detected.
- **Electron Sandbox**: `contextIsolation` is enabled; preload script uses `contextBridge`.

#### 🟡 Warnings
- **Dependency Audit**: `npm audit` found 7 vulnerabilities in production dependencies (mostly transitive). Recommended: Run `npm update` and `npm audit fix`.
- **Open Mode Auth**: The Proxy Server defaults to bypassing authentication if no API key is configured. 
    - *Risk*: Unauthorized access if exposed to the network without a key.
    - *Mitigation*: Ensure an API key is generated and set during first-run or deployment.

#### 🔴 Critical
- None detected.
