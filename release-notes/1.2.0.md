# What's New — Version 1.2.0

## Highlights

- **IPv4 Network & Host Addresses**: Generate sequential IP addresses (`192.168.1.1:1`) with automatic 32-bit subnet boundary rollover (`192.168.1.255:1` → `192.168.2.0`), CIDR notation preservation (`10.0.0.1/24:1`), negative steps (`10.0.1.0:-1`), formats (`~0`, `~hex`, `~bin`, `~int`), and configurable default via `insertseq.ipStart`.
- **Random Tokens, Passwords & Hashes**: Create cryptographically secure random alphanumeric tokens (`:rnd:16`), passwords (`:pwd:16`), hexadecimal hashes (`:hex:32`), URL-safe tokens (`:token:24`), and numeric PIN / OTP codes (`:rnd:6~d`).
- **UUID Generator (v4 & v7)**: Generate standard v4 UUIDs (`:uuid`) or time-sortable v7 UUIDs (`:uuid:v7`), with uppercase (`~u`) and clean/no-hyphen (`~c`) formatting.
- **Roman Numerals**: Format numeric sequences as Roman numerals using `~R` or `~roman` (uppercase: `I, II, III...`) and `~r` (lowercase: `i, ii, iii...`).
- **Extended Date & Time**: Support for clock times (`%14:00`), compound duration steps (`:1d15min`, `:2h30min`), and timestamps (`~epoch`, `~epochms`, `~iso`, `~utc`).
- **Feature Overview (Agenda)**: Quick-reference table added to the top of `README.md` to see all capabilities at a single glance.

See CHANGELOG.md and README.md for full syntax and examples.
