# Security Specification & Payload-First Red-Team Audit (Q-BIOCHECK BBKHIT DKI Jakarta)

## 1. Data Invariants
1. **Default Deny**: All unmatched Firestore paths are denied by the top-level `match /{document=**} { allow read, write: if false; }` catch-all.
2. **Verified Identity**: All mutations require `request.auth != null && request.auth.token.email_verified == true`.
3. **PII Isolation**: User email addresses are stored exclusively in `/users/{userId}/private/{docId}` and never exposed in `/users/{userId}`. Only the owner (`isOwner(userId)`) or an admin (`isAdmin()`) may read private PII.
4. **No Self-Assigned Privilege**: Users creating or updating `/users/{userId}` cannot set `role: "admin"` unless already recognized by `isAdmin()` (via `/admins/{uid}` or verified runtime admin email).
5. **Immutable Ownership & Timestamps**: `uid`, `ownerId`, and `createdAt` cannot change after creation; `createdAt` (on create) and `updatedAt` (on create/update) must strictly equal `request.time`.
6. **Master Gate Relational Sync**: `/users/{userId}/private/{docId}` verifies the parent `/users/{userId}` exists (`exists` on create, `get` on update/read).
7. **Strict Path & Field Bounds**: All IDs match `^[a-zA-Z0-9_\-]+$` (`1..128` chars) and all strings enforce explicit `.size()` boundaries.
8. **No Blanket List Reads**: Every `allow list` explicitly checks `resource.data.ownerId == request.auth.uid || isAdmin()` (never `allow list: if isSignedIn();`).

## 2. "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Write**: `setDoc(doc(db, 'quarantine_notes', 'n1'), { ... })` with `auth == null` -> DENIED.
2. **Unverified Email Spoofing**: `setDoc` to `/watchlist_items/w1` with `email: 'juliomarsc09@gmail.com'` and `email_verified: false` -> DENIED.
3. **PII Cross-User Read**: User A `getDoc(doc(db, 'users/userB/private/info'))` -> DENIED.
4. **Self-Assigned Admin Role**: User A creates `/users/userA` with `{ role: 'admin', ... }` -> DENIED.
5. **Shadow / Ghost Field Injection**: `setDoc` on `/quarantine_notes/n1` adding unexpected `isApproved: true` -> DENIED by `keys().hasOnly(...)`.
6. **ID Poisoning (1.5KB ID / Illegal Chars)**: `setDoc(doc(db, 'quarantine_notes', '../admin'), ...)` or 1500-char doc ID -> DENIED by `isValidId()`.
7. **Ownership Spoofing on Create**: User A creates `/watchlist_items/w2` with `ownerId: 'userB'` -> DENIED.
8. **Immutable Field Tampering on Update**: User A updates `/quarantine_notes/n1` modifying `ownerId` or `createdAt` -> DENIED.
9. **Client Timestamp Forgery**: `setDoc` on `/quarantine_notes/n1` with client `createdAt` != server `request.time` -> DENIED.
10. **Denial-of-Wallet String Overflow**: `setDoc` on `/quarantine_notes/n1` with `note` length `5000` (> `600` max) -> DENIED.
11. **Blanket List Scraping**: User A queries `getDocs(collection(db, 'quarantine_notes'))` without `where('ownerId', '==', auth.uid)` -> DENIED by `allow list`.
12. **Orphan Private Subcollection Write**: Creating `/users/userA/private/info` when parent `/users/userA` does not exist -> DENIED by parent `exists(...)` check.
