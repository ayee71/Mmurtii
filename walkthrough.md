# Security Summary

**Reviewed Files**: 48
**Issues Resolved**: 6

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Unsanitized Print Output | `src/components/TelegramArchiveSearch.tsx` | 237 | Case summaries and titles were written directly into a popup window with `document.write()` without HTML escaping. | High | Fixed | Replaced `window.open()` + `document.write()` with HTML-escaped rendering inside a hidden `iframe.srcdoc` (same pattern applied in `ControlDashboardView.tsx`, `LegalMeetingRoomView.tsx`, and `ArchiveAssistantWidget.tsx`). |
| Hardcoded Credentials & Login Bypass | `src/components/CourtWorkflowAndCredentialsCard.tsx` | 1 | A shortcut button bypassed authentication using hardcoded staff passcodes (`CLERK-2026`, `COORD-2026`, `JUDGE-2026`) and credentials (`admin@mmurtii.com`). | High | Fixed | Removed all hardcoded passcodes and the instant-login bypass while keeping the 4-tier court workflow guide and authenticated navigation. |
| Client-Supplied AI API Keys | `server-app.ts` | 6012 | Request headers (`X-Custom-Api-Key` / `x-openai-api-key`) could override server AI provider credentials, alongside a client-side key field in Settings. | Medium | Fixed | Removed client header overrides and the client Settings key input so provider credentials stay strictly in server `process.env`. |
| Namecheap Server IP Fallback | `server-app.ts` | 6181 | Domain check route previously fell back to `127.0.0.1` when `NAMECHEAP_CLIENT_IP` was missing instead of failing closed. | Medium | Fixed | Added `NAMECHEAP_CLIENT_IP` to `.env.example` and enforced HTTP `503` fail-closed rejection whenever required Namecheap credentials or client IP are unset. |
| Fabricated Legal Citation Match | `src/server/legal/legalSearch.ts` | 524 | Queries asking for non-existent proclamations alongside broad words (e.g., `"Ethiopia"`, `"tax"`) could surface unrelated statutes instead of returning insufficient evidence. | Medium | Fixed | Tightened `evaluateCandidateRelevance` so explicit proclamation-number misses require multi-token concept confirmation (`tokenHits >= 3` and `sharedConcepts.length >= 1`), causing non-existent proclamation queries to return `INSUFFICIENT_SOURCES`. |
| Cross-Language Deterministic Output | `src/server/legal/legalAnswerService.ts` | 339 | Deep-mode deterministic fallback answers emitted Afaan Oromoo section titles even when English (`en`) or Amharic (`am`) was requested. | Low | Fixed | Localized all `A`–`I` headings, labels, and status tags in `buildStructuredDeterministicAnswer` across `om`, `am`, and `en`. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Legal Source Staging & Review RBAC | `src/server/legal/legalAnswerRoute.ts` | Verifies Firebase ID tokens, rejects anonymous and unverified accounts, enforces authorized editor/admin roles, and blocks self-approval via two-person review. |
| Institutional Document Isolation | `src/server/legal/legalAnswerRoute.ts` | Checks caller `institutionId` on non-public source reads (`/sources/:id/content`) and search queries before returning confidential records. |
| Telegram Admin & Webhook Routes | `server-app.ts` | `/api/telegram/setup-webhook` and `/api/telegram/broadcast-briefing` require constant-time secret comparison or verified admin Bearer tokens. |
| Glossary & Translation Feedback APIs | `src/server/legal/glossaryRoute.ts` | Enforces verified non-anonymous Firebase auth on submissions/moderation, strips private reviewer notes from user responses, and neutralizes CSV formula prefixes. |
| Sign-Out Cache Purge & Cross-Tab Lock | `src/services/signOutSafetyService.ts` | Purges 13 IndexedDB stores and blocks cross-user switching if plaintext offline records remain uncleaned. |
| Production Rulesets | `firestore.rules` | Pre-existing production rules files remain untouched (`storage.rules` and `firestore.rules`) alongside hardened candidate rulesets ready for emulator validation. |

---

## PoC Verification

### Unsanitized HTML Print Output in Archive & Dashboard Views

#### Summary
| Field | Value |
|---|---|
| Issue Type | Unsanitized HTML Injection via Popup `document.write()` |
| Impact | High |
| Affected File | `src/components/TelegramArchiveSearch.tsx:237` |
| Test Scenario | Record title or summary containing `<img src=x onerror=alert(1)>` passed to `handlePrint(file)` |

#### How It Was Fixed
Removed the `window.open()` + `document.write()` sink and introduced an `esc()` helper that encodes `&`, `<`, `>`, and `"` before assigning markup to a hidden `iframe.srcdoc`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Print payload enters `handlePrint(file)` in `src/components/TelegramArchiveSearch.tsx:237` | Title, summary, and principle strings enter print formatter |
| 2 | `esc()` at lines `238`–`243` encodes `<`, `>`, `&`, and `"` to HTML entities | Script/event attributes cannot break out of text context |
| 3 | Encoded markup is written to hidden `iframe.srcdoc` (`line 252`) instead of `window.open().document.write()` | **Handled Safely** |

#### Conclusion
**Fix Verified** - Embedded `<img src=x onerror=...>` payloads are rendered as harmless literal text and cannot execute script during printing.

---

### Unauthenticated Legal Source Upload & Institutional Isolation

#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing Sign-In / Role Check on Source Staging |
| Impact | High |
| Affected File | `src/server/legal/legalAnswerRoute.ts:98` |
| Test Scenario | Unauthenticated `POST /api/legal/sources/upload` request sent without a Bearer token |

#### How It Was Fixed
`authenticateLegalEditorRequest` extracts and verifies the Firebase ID token via Firebase Admin Auth, rejects anonymous/unverified users, and validates editor/admin roles before invoking `stageLegalSource`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Request hits `router.post("/sources/upload")` (`src/server/legal/legalAnswerRoute.ts:296`) | Enters route handler |
| 2 | Calls `authenticateLegalEditorRequest(req)` (`lines 98`–`111`); missing `Authorization: Bearer` header triggers fail-closed return | Returns HTTP `401 UNAUTHENTICATED` |
| 3 | Live HTTP probe `POST /api/legal/sources/upload` without credentials returns `401` | **Handled Safely** |

#### Conclusion
**Fix Verified** - Unauthenticated callers are rejected with HTTP `401` before reaching legal repository staging logic.

---

### Fabricated Proclamation Anti-Fabrication Gate

#### Summary
| Field | Value |
|---|---|
| Issue Type | False-Positive Source Grounding on Non-Existent Statute Query |
| Impact | Medium |
| Affected File | `src/server/legal/legalSearch.ts:524` |
| Test Scenario | `POST /api/legal/ask` with `"What is the fictional Zorgon Tax Proclamation 9999/2099 in Ethiopia?"` |

#### How It Was Fixed
Tightened `evaluateCandidateRelevance` (`lines 524`–`531`) so queries containing an explicit proclamation number that fails to match any document cannot pass on weak single-word overlaps like `"Ethiopia"` or `"tax"`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Query enters `POST /api/legal/ask` -> `answerLegalQuestion` -> `searchLegalSources` | Extracts `9999/2099` into `extractedProclamationNumbers` |
| 2 | `evaluateCandidateRelevance` (`src/server/legal/legalSearch.ts:524`) finds no matching proclamation and `< 3` token hits with concept confirmation | Discards candidate (`score: 0`) |
| 3 | `answerLegalQuestion` (`src/server/legal/legalAnswerService.ts:438`) observes `retrievedSources.length === 0` | Returns `INSUFFICIENT_SOURCES` with `citations: []` (**Handled Safely**) |

#### Conclusion
**Fix Verified** - Live probe confirmed fictional proclamation queries return `INSUFFICIENT_SOURCES` and zero fabricated citations.
