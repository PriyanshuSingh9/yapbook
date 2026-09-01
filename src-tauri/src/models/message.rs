use serde::{Deserialize, Serialize};

/*
1. Field Visibility and Module Privacy (TRPL Ch 7):
   - In Rust, struct fields remain private by default even if the struct itself
     is declared `pub`.
   - All message fields (`id`, `group_id`, `sender`, etc.) are explicitly marked
     `pub` so external modules (the streaming parser, SQLite writer actor,
     and analytics engine) can construct and read them without accessor boilerplate.
2. Zero Runtime Overhead Serialization (Serde):
   - `#[serde(rename_all = "camelCase")]` is a compile-time procedural macro.
   - It emits static string slices directly into the binary's read-only data
     segment (.rodata), converting PascalCase variants (e.g. `MediaOmitted`)
     to `"mediaOmitted"` and snake_case fields (e.g. `group_id`) to `"groupId"`.
   - This bridges Rust memory structures with TypeScript frontend conventions
     with strictly 0 bytes of heap allocation and 0 nanoseconds of runtime penalty.
3. Primitive Type Selection & Memory Footprint:
   - `id: i64`: Maps 1:1 to SQLite `INTEGER PRIMARY KEY` (signed 64-bit ROWID)
     without integer casting.
   - `timestamp: i64`: UTC epoch seconds avoids heap-allocated datetime types
     and provides O(1) integer comparison and chronological sorting.
   - `char_count` and `word_count`: Typed as `u32` (fixed 4 bytes across all
     CPU targets, supporting counts up to 4.29 billion) rather than platform-dependent `usize`.
   - `group_id`: Identifies the parent group chat entity across SQLite foreign keys.
4. Normalized State vs Derived Computation:
   - `estimated_tokens` is implemented as a method (`char_count as f32 / 4.0`)
     rather than a stored field.
   - For 126,000 messages, avoiding a dedicated `f32` field saves ~500 KB of RAM
     and 1 MB of SQLite storage, preserving `char_count` as the Single Source of Truth.
5. Rhythm & Verbosity Classification (`MessageShape`):
   - Classifies dialogue length (`EmojiOnly`, `SingleWord`, `Short`, `Medium`, `Long`)
     to assist downstream storyboard pacing and speech bubble geometry fitting.
*/
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MessageType {
    Text,
    System,
    Deleted,
    Link,
    MediaOmitted,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MessageShape {
    EmojiOnly,
    SingleWord,
    Short,
    Medium,
    Long,
    Placeholder,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    pub id: i64,
    pub group_id: String,
    pub timestamp: i64, // Epoch Seconds
    pub sender: String,
    pub content: String,
    pub msg_type: MessageType,
    pub char_count: u32,
    pub word_count: u32,
    pub shape: MessageShape,
}

impl Message {
    pub fn estimated_tokens(&self) -> f32 {
        self.char_count as f32 / 4.0
    }
}
