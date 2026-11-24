# Firestore Security Specification (Phase 0)

## Data Invariants
1. **Default Deny**: Every unmatched path is denied (`allow read, write: if false`).
2. **No-Login Operational Parity Across AI Studio & Published**: Shared operational singleton documents (`shared_meta/current`, `shared_branding/current`, `shared_watchlists/current`, `shared_compliance/current`, `shared_contacts/current`, `shared_logs/current`) and bounded dataset shards (`shared_dataset_shards/shard_XXX`, `shared_contact_shards/shard_XXX`) support direct `get`, `create`, and `update` without requiring Google sign-in, while blocking collection-wide `list` scraping (`allow list: if false`) and blocking all client-side `delete` operations (`allow delete: if false`).
3. **Anti-Rollback Version Lock**: Updates to `shared_meta/current` MUST satisfy `incoming().shardVersion > existing().shardVersion`, preventing stale containers or offline caches from overwriting newer Cloud records.
4. **Strict Officer Identity & PII Isolation**: `/users/{userId}`, `/users/{userId}/private/{docId}`, `/admins/{userId}`, `/watchlist_items/{itemId}`, and `/quarantine_notes/{noteId}` strictly require `isSignedIn()` (`request.auth != null && request.auth.token.email_verified == true`) and `isOwner(userId)` or `isAdmin()`.
5. **Immutable Audit Fields & Server Timestamps**: `createdAt` is immutable after creation; `createdAt`/`updatedAt` must equal `request.time`. `shard_XXX` `index` is immutable after creation.
6. **Size & Type Guards**: All strings have explicit `.size()` bounds; all lists have bounded `.size()` and element-0 type guards; `shardCount`, `recordCount`, and `contactCount` have strict integer bounds; all `create` and `update` paths validate `hasOnly` / `affectedKeys().hasOnly`.

## Dirty Dozen Payloads (Must Fail With PERMISSION_DENIED)
1. Unauthenticated read or write on `/users/{uid}/private/info` (`request.auth == null`).
2. Collection-wide `list` query against `/shared_dataset_shards`, `/shared_contact_shards`, `/shared_meta`, or `/shared_contacts` (`allow list: if false`).
3. Downgrading or replaying `shardVersion` (`incoming().shardVersion <= existing().shardVersion`) on `/shared_meta/current`.
4. Injecting ghost field (`isVerified: true`) into `/shared_meta/current` (`hasOnly` rejects).
5. Forging client timestamp (`updatedAt` != `request.time`) on `/shared_watchlists/current`.
6. Oversized custom logo (> 350KB) into `/shared_branding/current`.
7. Oversized list (> 450 items) or primitive scalar element inside `records` in `/shared_dataset_shards/shard_000`.
8. Deleting `/shared_meta/current`, `/shared_dataset_shards/shard_000`, or `/shared_contacts/current` (`allow delete: if false`).
9. Self-escalating `/users/{uid}` `role` from `'officer'` to `'admin'` on create or update.
10. Poisoned shard document ID (`shardId` not matching `^shard_[0-9]{3}$` or > 128 chars).
11. Unverified email account writing to `/watchlist_items/{itemId}` (`email_verified == false`).
12. Mutating `index` field on an existing `/shared_dataset_shards/shard_000` or `/shared_contact_shards/shard_000`.
