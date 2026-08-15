# Yapbook — Documentation Home

> The entry point for everyone working on Yapbook. Read this first, then follow the links.
> Every document below lives in this `docs/` folder unless stated otherwise.

## Why this structure exists

Yapbook is a two-person, two-track project — a Rust core engine and a React frontend + image pipeline — driven by a single master roadmap. These docs exist so that:

- **Everyone agrees on what we're building** — one canonical roadmap, not chat history.
- **Both tracks can run in parallel** — shared contracts define the seam between them.
- **Decisions stay recorded** — the decision log captures _why_, so nothing gets re-litigated.
- **Numbers stay honest** — performance claims trace back to committed benchmark artifacts.

## The Docs Map

| Document                                             | Purpose                                                             | Audience                   | Status      |
| :--------------------------------------------------- | :------------------------------------------------------------------ | :------------------------- | :---------- |
| [Master Roadmap](milestones.md)                      | What we build, why, in what order (Features 1–15)                   | Everyone — canonical scope | Living      |
| [System Architecture](architecture.md)               | How the system is designed and why (glossary, topology, patterns)   | Everyone                   | Living      |
| [Priyanshu's Track](priyanshu/milestones.md)         | Rust core, SQLite, inference, persistence, compositor (P1–P12)      | Priyanshu                  | Living      |
| [Ashwani's Track](ashwani/milestones.md)             | Frontend, Studio Canvas, image generation pipeline (A1–A8)          | Ashwani                    | Living      |
| [Shared Contracts](contracts.md)                     | The typed seam between Rust and React — the parallel-work agreement | Both tracks                | Living      |
| [Decision Log](decisions.md)                         | Architectural decisions, ADR-style (D-001 …)                        | Everyone                   | Append-only |
| [Processing Times & Benchmarks](processing-times.md) | Empirical performance estimates, hardware tiers                     | Everyone                   | Living      |

### Where specific knowledge lives

| You want to know...                         | Go to                                                                             |
| :------------------------------------------ | :-------------------------------------------------------------------------------- |
| What we're building and why, in order       | [milestones.md](milestones.md) + track docs                                       |
| How the system is wired together            | [architecture.md](architecture.md)                                                |
| Who owns which interface between the tracks | [contracts.md](contracts.md)                                                      |
| Why we chose X over Y                       | [decisions.md](decisions.md)                                                      |
| How fast each stage is                      | [processing-times.md](processing-times.md) (grounded in `benchmarks/chat-stats/`) |
| How to get the repo running                 | [setup.md](setup.md)                                                              |

## Conventions

1. **The master roadmap is canonical for scope.** Track docs mirror its features with `P`/`A` prefixes. If a feature's scope changes, update the master roadmap first, then the affected track docs.
2. **Contracts are a promise.** Any contract change must land in three places in the same change: this agreement ([contracts.md](contracts.md)), the Rust type, and the TypeScript type. Never change one side silently.
3. **Decisions get logged.** Any architectural choice with more than one viable option goes into [decisions.md](decisions.md) in ADR format — not just into a chat message.
4. **Numbers must be traceable.** Performance claims in the docs must match committed benchmark artifacts (e.g. `benchmarks/chat-stats/report.json`). When the data changes, update the numbers.
5. **Tick the checkboxes.** Progress trackers live in [milestones.md](milestones.md) and the track docs. Keep them current so the other dev can see state at a glance.
6. **Small, focused diffs.** Docs are living: update them in the same change as the code they describe. Don't save up documentation work.

## Folder conventions

- `docs/*.md` — project-wide documents (roadmap, architecture, contracts, decisions, setup, benchmarks).
- `docs/priyanshu/`, `docs/ashwani/` — per-track documents. Each track owns its subfolder.
- File names are lowercase-kebab (`contracts.md`), so links stay predictable.
- The glossary lives in [architecture.md](architecture.md#glossary) — one glossary, referenced everywhere, never duplicated.

## How the two tracks work in parallel

1. Pick a feature from your track doc (a `P` or `A` feature).
2. Check the dependency graph in [milestones.md](milestones.md#dependency-graph) — are your inputs ready, or do you need mocks?
3. Check [contracts.md](contracts.md) for the interface you produce or consume.
4. Build against mock fixtures until the real backend lands (see the "Zero-Block" / "Zero-Wait" rules in the track docs).
5. Tick your checklist; if the interface changed, update [contracts.md](contracts.md) and both codebases in the same change.
