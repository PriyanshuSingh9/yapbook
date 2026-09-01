use serde::{Deserialize, Serialize};
use thiserror::Error;
/*
1. Type Safety vs. Stringly-Typed Errors:
   - Returning standard Result<T, String> destroys compiler-enforced error handling.
   - Callers cannot pattern-match on specific failure modes to decide whether to
     retry, display a warning, fall back, or abort.
   - An enum groups bounded failure domains into a single closed type that the
     compiler checks for exhaustiveness.
2. The Rust Standard Error Traits (TRPL Ch 9):
   - Any production Rust error type must implement two standard traits:
     a) std::fmt::Display: Human-readable error messages for users and UI toasts.
     b) std::error::Error: Low-level inspection, backtraces, and source chains.
   - Implementing Display and Error manually for multi-variant enums requires
     repetitive boilerplate match statements across every variant.
3. Why `thiserror` over `anyhow`:
   - `thiserror` is a macro crate designed for domain and library code. It generates
     Display and Error trait implementations at compile time with zero runtime overhead.
   - `anyhow` is intended for application binaries where errors are only printed
     to the console; it erases concrete types into dynamic trait objects (Box<dyn Error>),
     preventing callers from inspecting the underlying variant.
4. Cross-Boundary IPC Serialization via Serde:
   - In memory, Rust enums are tagged unions (discriminant byte + variant payload).
   - The React/TypeScript frontend runs in a separate V8 process and cannot read
     native Rust memory structures.
   - Tauri serializes Rust types to JSON strings across the IPC webview bridge.
5. Adjacent Tagging Strategy (tag = "kind", content = "message"):
   - Default Serde enum serialization produces external tags: {"Io": "..."}.
   - In TypeScript, handling dynamically keyed objects requires messy type gymnastics.
   - Adjacent tagging serializes variants as: { "kind": "io", "message": "..." }.
   - This directly matches TypeScript discriminated unions:
     type AppError = { kind: "io"; message: string } | ...
   - `rename_all = "camelCase"` reconciles Rust's snake_case naming with TypeScript conventions.
6. Error Propagation via the `?` Operator and the `From` Trait:
    - The `?` operator uses `From::from` under the hood.
    - Implementing `From<std::io::Error> for AppError` allows standard library I/O
    calls to propagate seamlessly out of functions returning AppResult<T>
    without verbose .map_err() calls.
7. Why `From<std::io::Error>` is implemented now, but not other errors:
    - `std::io::Error` is a foreign concrete type from Rust's standard library.
    Functions returning AppResult<T> need From<std::io::Error> so that `?` can
    automatically convert filesystem failures into AppError::Io.
    - `Parser` and `Security` errors are domain-internal and created directly by
    our application code (e.g. Err(AppError::Parser(...))), so no conversion trait is needed.
    - `Database` (rusqlite::Error) and `Inference` (reqwest::Error) will get their
    own `From` implementations in future sprints when those third-party dependencies are added.
*/
#[derive(Debug, Error, Serialize, Deserialize)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
pub enum AppError {
    #[error("io error: {0}")]
    Io(String),
    #[error("database error: {0}")]
    Database(String),
    #[error("parser error: {0}")]
    Parser(String),
    #[error("inference error: {0}")]
    Inference(String),
    #[error("security error: {0}")]
    Security(String),
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Io(err.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
