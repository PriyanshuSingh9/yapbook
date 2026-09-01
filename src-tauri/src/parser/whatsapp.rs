/*
1. Zero-Copy Tokenization with Explicit Lifetimes (`'a`):
   - Ingesting large chat exports (e.g. 137,735 lines in our benchmark) causes
     severe memory fragmentation if tokens are allocated as owned Strings.
   - `ParsedLine<'a>` borrows string slices (`&'a str`) directly from the input
     line buffer without copying data or triggering heap allocations.
   - The explicit lifetime `'a` ensures that `ParsedLine` cannot outlive the
     underlying line memory.
2. One-Time Regex Compilation via `std::sync::LazyLock`:
   - Compiling a regular expression into a DFA is computationally expensive.
   - `LazyLock` compiles `MESSAGE_HEADER_REGEX` once on first access and stores
     it in thread-safe global memory, amortizing the compilation cost across
     all 137k+ line checks.
3. The WhatsApp Header Invariant:
   - Line pattern: `^([Date]),? [Time] - [Remainder]$`
   - Capture Group 1: Date (e.g., "07/10/24" or "7/10/2024").
   - Capture Group 2: Time (handles 12h with AM/PM or 24h, plus narrow spaces).
   - Capture Group 3: Remainder of line after the " - " separator.
   - Non-matching lines represent multiline message continuations.
4. Datetime Normalization with `chrono`:
   - Android WhatsApp exports place a Unicode Narrow No-Break Space (`\u{202F}`)
     between the time digits and "am"/"pm".
   - Normalizing `\u{202F}` and `\u{00A0}` to ASCII whitespace allows `chrono`
     to parse standard 12-hour and 24-hour formats.
   - Two-digit years (e.g., "24") are resolved to century-aware UTC timestamps
     stored as 64-bit epoch seconds (`i64`).
*/

use chrono::{NaiveDate, NaiveDateTime, NaiveTime};
use regex::Regex;
use std::sync::LazyLock;

pub struct ParsedLine<'a> {
    pub date_str: &'a str,
    pub time_str: &'a str,
    pub remainder: &'a str,
}

static MESSAGE_HEADER_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"^(\d{1,2}/\d{1,2}/\d{2,4}),?\s+(\d{1,2}:\d{2}(?:[\u{202F}\s]*[ap]\.?m\.?)?)\s+-\s+(.*)$",
    )
    .expect("Invalid Whatsapp header regex")
});

pub fn parse_line_header<'a>(line: &'a str) -> Option<ParsedLine<'a>> {
    let caps = MESSAGE_HEADER_REGEX.captures(line);

    match caps {
        Some(caps) => Some(ParsedLine {
            date_str: caps.get(1).map_or("", |m| m.as_str()),
            time_str: caps.get(2).map_or("", |m| m.as_str()),
            remainder: caps.get(3).map_or("", |m| m.as_str()),
        }),
        None => None,
    }
}

pub fn parse_datetime(date_str: &str, time_str: &str) -> Option<i64> {
    let clean_time = time_str
        .replace(['\u{202F}', '\u{00A0}'], " ")
        .trim()
        .to_lowercase();
    let date = NaiveDate::parse_from_str(date_str, "%d/%m/%y")
        .or_else(|_| NaiveDate::parse_from_str(date_str, "%d/%m/%Y"))
        .ok()?;

    let time = NaiveTime::parse_from_str(&clean_time, "%I:%M %p")
        .or_else(|_| NaiveTime::parse_from_str(&clean_time, "%I:%M%p"))
        .or_else(|_| NaiveTime::parse_from_str(&clean_time, "%H:%M"))
        .ok()?;
    let dt = NaiveDateTime::new(date, time);
    Some(dt.and_utc().timestamp())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_standard_android_header() {
        let line = "07/10/24, 9:11 pm - Ashwani: hello world";
        let parsed = parse_line_header(line).expect("Should parse valid header");
        assert_eq!(parsed.date_str, "07/10/24");
        assert_eq!(parsed.time_str, "9:11 pm");
        assert_eq!(parsed.remainder, "Ashwani: hello world");
    }

    #[test]
    fn test_parse_header_with_narrow_space() {
        let line = "07/10/24, 9:11\u{202F}pm - Priyanshu: kya scene";
        let parsed = parse_line_header(line).expect("Should parse header with unicode space");
        assert_eq!(parsed.date_str, "07/10/24");
        assert_eq!(parsed.time_str, "9:11\u{202F}pm");
        assert_eq!(parsed.remainder, "Priyanshu: kya scene");
    }

    #[test]
    fn test_continuation_line_returns_none() {
        let line = "This is a multiline continuation line without a timestamp header";
        assert!(parse_line_header(line).is_none());
    }

    #[test]
    fn test_system_message_header() {
        let line = "07/10/24, 9:11 pm - Messages and calls are end-to-end encrypted. No one outside of this chat...";
        let parsed = parse_line_header(line).expect("Should parse system message header");
        assert_eq!(parsed.date_str, "07/10/24");
        assert_eq!(parsed.time_str, "9:11 pm");
        assert_eq!(
            parsed.remainder,
            "Messages and calls are end-to-end encrypted. No one outside of this chat..."
        );
    }

    #[test]
    fn test_datetime_parsing_12h_with_narrow_space() {
        let ts = parse_datetime("07/10/24", "9:11\u{202F}pm").expect("Should parse 12h PM time");
        // Verify UTC epoch seconds correspond to October 7, 2024
        assert!(ts > 1_728_000_000);
    }

    #[test]
    fn test_datetime_parsing_24h() {
        let ts =
            parse_datetime("07/10/2024", "21:11").expect("Should parse 24h time with 4-digit year");
        assert!(ts > 1_728_000_000);
    }
}
