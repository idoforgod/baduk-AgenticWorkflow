// Baduk PoC — Tauri 2.0 backend
// Validates: Tauri commands (IPC), KataGo sidecar spawn, process lifecycle
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

// Basic Tauri IPC command — proves Rust↔JS communication
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// KataGo sidecar spawn command — spawns the sidecar and sends a GTP command
// Returns the engine response (proves process spawn + stdio communication)
#[tauri::command]
async fn katago_gtp_command(app: tauri::AppHandle, command: String) -> Result<String, String> {
    let shell = app.shell();

    // Spawn the KataGo sidecar (binary must be at binaries/katago-{triple})
    let (mut rx, mut child) = shell
        .sidecar("binaries/katago")
        .map_err(|e| format!("Failed to create sidecar: {}", e))?
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    // Send the GTP command via stdin
    child
        .write(format!("{}\nquit\n", command).as_bytes())
        .map_err(|e| format!("Failed to write to stdin: {}", e))?;

    // Collect stdout responses
    let mut response_lines: Vec<String> = Vec::new();
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line) => {
                let line_str = String::from_utf8_lossy(&line).to_string();
                // Stop collecting after we see the quit response
                let is_quit = line_str.starts_with('=') && response_lines
                    .iter()
                    .any(|l: &String| l.starts_with('='));
                response_lines.push(line_str.clone());
                if is_quit {
                    break;
                }
            }
            CommandEvent::Stderr(line) => {
                // KataGo writes startup messages to stderr — log but don't fail
                eprintln!("[katago stderr] {}", String::from_utf8_lossy(&line));
            }
            CommandEvent::Terminated(_) => break,
            _ => {}
        }
    }

    Ok(response_lines.join("\n"))
}

// Validate that the sidecar binary exists and is executable
#[tauri::command]
async fn katago_version(app: tauri::AppHandle) -> Result<String, String> {
    katago_gtp_command(app, "version".to_string()).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            katago_gtp_command,
            katago_version
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
