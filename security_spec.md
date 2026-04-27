# Auditor AI Security Specification

## Data Invariants
1. **Relational Integrity**: An Expense or Report must never exist outside of a `/users/{userId}/` subcollection, where `{userId}` matches the authenticated user's UID.
2. **Quota Sovereignty**: A user cannot modify their own `plan` or increment their `scansLeft`. Only the server-side logic (authenticated via Admin SDK or system-level updates) can modify these governance fields.
3. **Identity Mirroring**: The `userId` field (or the parent collection ID) must strictly match `request.auth.uid`.
4. **Temporal Consistency**: `createdAt` must be set by `request.time` and remains immutable after creation.
5. **State Finality**: Once a Report status is 'Reimbursed', it cannot be modified or deleted.

## The "Dirty Dozen" Payloads (Targeting Vulnerabilities)
1. **Identity Spoofing**: Attempt to create an expense in `users/alice/expenses/123` while logged in as `bob`.
2. **Quota Hijacking**: Attempt to update `users/bob` to set `plan: "ENTERPRISE"`.
3. **Shadow Field Injection**: Attempt to create an expense with `isVerifiedByAdmin: true` (a field not in the schema).
4. **ID Poisoning**: Attempt to use a 2MB string as a document ID for a report.
5. **Timestamp Backdating**: Attempt to set `createdAt` to a date in 2020.
6. **Relational Orphanage**: Attempt to create an expense without a vendor or amount.
7. **Negative Valuation**: Attempt to set `amount: -1000.00` on an expense.
8. **State Shortcut**: Attempt to update a 'Draft' report directly to 'Reimbursed' bypassing auditing (if logic requires it).
9. **Terminal State Violation**: Attempt to update an expense linked to a 'Reimbursed' report.
10. **PII Leakage**: Attempt to read the entire `/users` collection as a standard logged-in user (List query without filter).
11. **Feedback Spam**: Attempt to create a feedback entry with `rating: 99`.
12. **Metadata Tampering**: Attempt to modify the `email` of a user profile to a collision target.

## Test Suite Plan
The `firestore.rules.test.ts` will verify:
- Permission Denied for all 12 Dirty Dozen payloads.
- Permission Granted for valid CRUD operations within a user's own path.
- Absolute negation of write access to the `/users/{userId}` governance fields (`plan`, `scansLeft`).
