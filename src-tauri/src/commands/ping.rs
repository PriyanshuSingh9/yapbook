use crate::AppResult;

/*
1. Attribute Procedural Macro (`#[tauri::command]`):
   - At compile time, the macro inspects the function signature and generates
     companion IPC glue code and argument deserializers.
   - It exposes the function to Tauri's central invoke router without manual
     string dispatch or boilerplate JSON parsing.
   - It preserves your clean Rust function signatures while generating the
     underlying Webview IPC adapter.
2. Cross-Boundary Error Propagation via `AppResult<T>`:
   - Returning `AppResult<T>` (`Result<T, AppError>`) establishes a strict
     error boundary between the native OS process and the frontend webview.
   - On `Ok(data)`: Tauri serializes the response and resolves the JS Promise.
   - On `Err(err)`: Tauri serializes `AppError` and rejects the JS Promise
     with `{ kind: "...", message: "..." }`, preventing silent failures
     or application crashes across the IPC seam.
3. Smoke Test Command (`ping`):
   - Acts as the baseline smoke test for the Tauri v2 IPC bridge.
   - Verifies end-to-end communication from React `invoke("ping")` -> native Rust -> `"pong"`.
*/
#[tauri::command]
pub fn ping() -> AppResult<String> {
    Ok("pong".to_string())
}
