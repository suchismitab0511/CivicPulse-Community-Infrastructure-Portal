# CivicPulse Firestore Security Specification & Threat Model

This document specifies the data invariants, strict access patterns, threat model, and "Dirty Dozen" attack payloads for the CivicPulse Firestore database.

## 1. Data Invariants & Zero-Trust Access Model

### Invariants for `issues` Collection
- **Immutability of Position**: Latitude, Longitude, and Address are set at creation and cannot be updated.
- **Incremental Upvotes Only**: Upvotes can only be modified by adding or removing the user's own `currentSessionId` from the `upvotedBy` array.
- **Terminal State Lock**: Once status is updated to `Resolved`, it should not be reverted or mutated to bypass civic oversight.
- **No Shadow Keys**: Every issue document must contain exactly the specified set of attributes.

### Invariants for `contributors` Collection
- **Self-Identity Alignment**: A client can only create or update their own contributor profile matching their unique `currentSessionId`.
- **Temporal Progression**: `updatedAt` must always align with server time `request.time`.

---

## 2. The "Dirty Dozen" Vulnerability Payloads

Below are twelve malicious payloads designed to bypass application controls, bypass validation gates, or launch "Denial of Wallet" exhaustion attacks. The firestore security rules must successfully prevent all of these operations.

| ID | Collection | Operation | Attack Vector | Expected Outcome |
|----|------------|-----------|---------------|------------------|
| P1 | issues | Create | Injection of massive `description` string (e.g., 2MB payload) to cause denial of wallet. | **REJECTED (Size Constraint)** |
| P2 | issues | Create | Injection of shadow keys (e.g. `isVerifiedByCouncil: true`) to bypass admin moderation. | **REJECTED (No Shadow Keys)** |
| P3 | issues | Create | Spooled/spoofed client-side timestamps instead of `request.time`. | **REJECTED (Temporal Integrity)** |
| P4 | issues | Create | Reporting an issue with negative `upvotes` or custom non-empty `upvotedBy` array. | **REJECTED (Initial State Lock)** |
| P5 | issues | Update | Unauthorized client attempting to change someone else's issue description or category. | **REJECTED (Action-Based Update)** |
| P6 | issues | Update | Forging upvotes by directly modifying `upvotes` count to 1000 without appending ID. | **REJECTED (Relational Integrity)** |
| P7 | issues | Update | Mutating latitude/longitude coordinates on an already reported issue. | **REJECTED (Immutability)** |
| P8 | contributors | Create | Registering a profile with a spoofed/malicious ID not conforming to valid path regex. | **REJECTED (Path Hardening)** |
| P9 | contributors | Create | Self-assigning a huge points boost (e.g., points = 99999) on registration. | **REJECTED (Registration Bounds)** |
| P10| contributors | Update | Hijacking someone else's contributor record to edit their username or steal points. | **REJECTED (Identity Alignment)** |
| P11| contributors | Update | Decrementing points or supplying a stale client timestamp for `updatedAt`. | **REJECTED (Temporal/State Check)** |
| P12| issues | Delete | Malicious user attempting to delete an infrastructure report to cover up damage. | **REJECTED (Immutable Records)** |

---

## 3. Threat Model Verification Strategy

Security verification is continuously simulated by testing actual API payloads. Every write action is validated against strict types, boundaries, and identity matches.

- **Unauthenticated Read Operations**: Allowed globally to encourage public civic engagement (allowing read access to feed, maps, and leaderboard).
- **Unauthenticated Write Operations**: Prevented for profile/contributor documents, but allowed for anonymous/guest issue submissions using a strict local session identifier, with total payload size limited to prevent system-wide exhaustion.
