// Mock KataGo GTP server for Tauri sidecar PoC validation
// Implements minimal GTP protocol: version, name, list_commands, quit
use std::io::{self, BufRead, Write};

fn main() {
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut out = stdout.lock();

    // GTP startup message to stderr (like real KataGo)
    eprintln!("KataGo Mock v1.16.2 GTP engine initialized");

    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) => l.trim().to_string(),
            Err(_) => break,
        };

        if line.is_empty() {
            continue;
        }

        // Parse GTP command (optional id + command + args)
        let parts: Vec<&str> = line.splitn(2, ' ').collect();
        let (id_str, command_line) = if parts[0].chars().all(|c| c.is_ascii_digit()) {
            (parts[0], if parts.len() > 1 { parts[1] } else { "" })
        } else {
            ("", line.as_str())
        };

        let cmd_parts: Vec<&str> = command_line.split_whitespace().collect();
        if cmd_parts.is_empty() {
            continue;
        }
        let command = cmd_parts[0].to_lowercase();

        let response = match command.as_str() {
            "version" => "1.16.2".to_string(),
            "name" => "KataGo Mock".to_string(),
            "protocol_version" => "2".to_string(),
            "list_commands" => {
                "version\nname\nprotocol_version\nlist_commands\nquit\ngenmove\nplay\nclear_board\nboardsize\nkomi\nfinal_score"
                    .to_string()
            }
            "boardsize" => "".to_string(),
            "clear_board" => "".to_string(),
            "komi" => "".to_string(),
            "play" => "".to_string(),
            "genmove" => {
                // Return a valid move (D4 on 19x19)
                "D4".to_string()
            }
            "final_score" => "B+5.5".to_string(),
            "kata-analyze" => {
                // Minimal analysis response
                r#"info move D4 visits 100 utility 0.45 winrate 0.55 scoreMean 5.5 scoreSelfplay 5.5 prior 0.12 lcb 0.48 utilityLcb 0.42 order 0 pv D4 Q16 R4 D16"#
                    .to_string()
            }
            "quit" => {
                writeln!(out, "={}", if id_str.is_empty() { "".to_string() } else { format!("{} ", id_str) }).unwrap();
                out.flush().unwrap();
                break;
            }
            _ => {
                // Unknown command — respond with error
                let prefix = if id_str.is_empty() { "".to_string() } else { format!("{} ", id_str) };
                writeln!(out, "?{}unknown command: {}", prefix, command).unwrap();
                out.flush().unwrap();
                continue;
            }
        };

        let prefix = if id_str.is_empty() { "".to_string() } else { format!("{} ", id_str) };
        writeln!(out, "={}{}", prefix, response).unwrap();
        writeln!(out).unwrap(); // GTP requires blank line after each response
        out.flush().unwrap();
    }
}
