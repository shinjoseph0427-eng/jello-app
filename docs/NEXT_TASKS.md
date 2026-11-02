# Next tasks

| ID | Priority | Task | Dependency | Size | Verification | Status |
|---|---:|---|---|---|---|---|
| A4 | P0 | Two-account onboarding/friend/moment smoke test | Two test sessions | S | Completed card visible to both | ready |
| A2.1 | P0 | Outgoing request state and cancellation | Friend RPCs | S | RPC/RLS tests | ready |
| B1 | P0 | Persist upload queue across restart/offline | In-memory retry now complete | M | Failure injection + restart | ready |
| B2 | P0 | Scheduled orphan audit/cleanup | Owner delete now complete | S | Orphan fixture removed | ready |
| C1 | P1 | Push tokens and transactional outbox | Push credentials | L | Duplicate-safe tests | planned |
| E1 | P1 | Block/report/account deletion | Retention policy | L | RLS + device | planned |
| D2 | P1 | Participant-only reactions | Stable core E2E | M | Permission tests | planned |
| D3 | P1 | Local composite export | Consent decision | M | Device share test | planned |
| F1 | P2 | WidgetKit/App Group | Stable sync contract | XL | Build + device | blocked |

Smallest next action: execute A4 and record each step without production user data.
