// =============================================================================
// commands/katago.rs — KataGo Bridge (7 commands)
// =============================================================================
// Uses std::process::Command + std::thread for maximum reliability.
// No dependency on tokio::process (avoids async runtime panic issues).
// =============================================================================

use crate::{
    katago::{write_stdin, KataGoProcess, KataGoStatus},
    AppState,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::BufRead;
use std::sync::{Arc, Mutex as StdMutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Manager, State};
use tokio::sync::{mpsc, oneshot, Mutex as TokioMutex};

// ---------------------------------------------------------------------------
// Payload Types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KataGoConfig {
    pub config_path: String,
    pub model_path: String,
    pub human_model_path: Option<String>,
    pub analysis_threads: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionInfo {
    pub version: String,
    pub git_hash: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisQuery {
    pub id: String,
    pub moves: Vec<[String; 2]>,
    pub rules: String,
    pub board_x_size: u32,
    pub board_y_size: u32,
    pub komi: Option<f64>,
    pub max_visits: Option<u32>,
    pub root_policy_temperature: Option<f64>,
    pub include_ownership: Option<bool>,
    pub analyze_turns: Option<Vec<u32>>,
    pub priority: Option<i32>,
    pub initial_stones: Option<Vec<[String; 2]>>,
    pub override_settings: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisResponse {
    pub id: String,
    pub turn_number: u32,
    pub move_infos: Vec<serde_json::Value>,
    pub root_info: serde_json::Value,
    pub is_during_search: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ownership: Option<Vec<f64>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ownership_stdev: Option<Vec<f64>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub policy: Option<Vec<f64>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub human_policy: Option<Vec<f64>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub no_results: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendInfo {
    pub backend_type: String,
    pub device_name: String,
    pub binary_name: String,
}

// ---------------------------------------------------------------------------
// Helper: recover from poisoned lock
// ---------------------------------------------------------------------------
fn lock_katago(
    state: &AppState,
) -> Result<std::sync::MutexGuard<'_, Option<KataGoProcess>>, String> {
    state
        .katago
        .lock()
        .or_else(|e| {
            eprintln!("[katago] recovering from poisoned lock");
            Ok(e.into_inner())
        })
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn katago_initialize(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    config: KataGoConfig,
) -> Result<VersionInfo, String> {
    eprintln!("[katago_initialize] starting...");

    // Resolve resource paths
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("resource_dir failed: {}", e))?;

    let config_path = resource_dir.join("resources/config/analysis.cfg");
    let model_path = resource_dir.join("resources/models/default-model.bin.gz");

    eprintln!("[katago_initialize] config: {:?} (exists={})", config_path, config_path.exists());
    eprintln!("[katago_initialize] model: {:?} (exists={})", model_path, model_path.exists());

    if !config_path.exists() {
        return Err(format!("config not found at {:?}", config_path));
    }
    if !model_path.exists() {
        return Err(format!("model not found at {:?}", model_path));
    }

    // Find katago binary next to the main executable
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("current_exe failed: {}", e))?;
    let exe_dir = exe_path
        .parent()
        .ok_or_else(|| "exe has no parent dir".to_string())?;

    let possible_names = ["katago", "katago-aarch64-apple-darwin"];
    let katago_bin = possible_names
        .iter()
        .map(|name| exe_dir.join(name))
        .find(|p| p.exists())
        .ok_or_else(|| {
            format!("katago binary not found in {:?}", exe_dir)
        })?;

    eprintln!("[katago_initialize] binary: {:?}", katago_bin);

    // Build arguments — do NOT pass -analysis-threads here because
    // numAnalysisThreads is already set in analysis.cfg and KataGo
    // disallows specifying it in both places.
    let args: Vec<String> = vec![
        "analysis".into(),
        "-config".into(),
        config_path.to_string_lossy().to_string(),
        "-model".into(),
        model_path.to_string_lossy().to_string(),
    ];

    eprintln!("[katago_initialize] spawning with args: {:?}", args);

    // Spawn using std::process::Command (no tokio dependency)
    let mut child = std::process::Command::new(&katago_bin)
        .args(&args)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("spawn failed: {} (binary={:?})", e, katago_bin))?;

    eprintln!("[katago_initialize] spawn succeeded, pid={}", child.id());

    let stdin = child.stdin.take().ok_or("failed to take stdin")?;
    let stdout = child.stdout.take().ok_or("failed to take stdout")?;
    let stderr = child.stderr.take().ok_or("failed to take stderr")?;

    let stdin_arc = Arc::new(StdMutex::new(stdin));

    // Response dispatching
    let pending_responses: Arc<TokioMutex<HashMap<String, oneshot::Sender<String>>>> =
        Arc::new(TokioMutex::new(HashMap::new()));

    // Stderr buffer
    let stderr_buffer: Arc<StdMutex<Vec<String>>> = Arc::new(StdMutex::new(Vec::new()));
    let stderr_buf_clone = stderr_buffer.clone();

    // Shutdown channel
    let (shutdown_tx, mut shutdown_rx) = mpsc::channel::<()>(1);

    // Background OS thread: read stdout lines and dispatch responses
    let pending_stdout = pending_responses.clone();
    std::thread::spawn(move || {
        let reader = std::io::BufReader::new(stdout);
        for line_result in reader.lines() {
            match line_result {
                Ok(line) => {
                    let line = line.trim().to_string();
                    if line.is_empty() {
                        continue;
                    }
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                        if let Some(id) = json.get("id").and_then(|v| v.as_str()) {
                            // Use blocking_lock from a non-async thread — this is safe
                            let mut pending = pending_stdout.blocking_lock();
                            if let Some(sender) = pending.remove(id) {
                                let _ = sender.send(line);
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("[katago stdout] read error: {}", e);
                    break;
                }
            }
        }
        eprintln!("[katago stdout] reader thread exiting");
        // Notify all pending callers that the process died
        let mut pending = pending_stdout.blocking_lock();
        for (_id, sender) in pending.drain() {
            let _ = sender.send(
                r#"{"error":"KataGo process exited"}"#.to_string(),
            );
        }
    });

    // Background OS thread: read stderr for diagnostics
    std::thread::spawn(move || {
        let reader = std::io::BufReader::new(stderr);
        for line_result in reader.lines() {
            match line_result {
                Ok(line) => {
                    let line = line.trim().to_string();
                    if line.is_empty() {
                        continue;
                    }
                    eprintln!("[katago stderr] {}", line);
                    if let Ok(mut buf) = stderr_buf_clone.lock() {
                        buf.push(line);
                        if buf.len() > 50 {
                            buf.remove(0);
                        }
                    }
                }
                Err(_) => break,
            }
        }
        eprintln!("[katago stderr] reader thread exiting");
    });

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    // Store process in AppState
    {
        let mut katago = lock_katago(state.inner())?;
        *katago = Some(KataGoProcess {
            stdin: stdin_arc.clone(),
            status: KataGoStatus::Starting,
            pending_responses: pending_responses.clone(),
            shutdown_tx: Some(shutdown_tx),
            start_time: now,
            stderr_buffer: stderr_buffer.clone(),
            failure_count: 0,
        });
    }

    eprintln!("[katago_initialize] sending query_version...");

    // Send query_version to verify startup
    let (resp_tx, resp_rx) = oneshot::channel::<String>();
    {
        let mut pending = pending_responses.lock().await;
        pending.insert("__startup__".to_string(), resp_tx);
    }

    write_stdin(&stdin_arc, b"{\"id\":\"__startup__\",\"action\":\"query_version\"}\n")
        .map_err(|e| format!("version query write: {}", e))?;

    eprintln!("[katago_initialize] waiting for version response (30s timeout)...");

    // Wait for response
    let version_response = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        resp_rx,
    )
    .await
    .map_err(|_| "timeout waiting for query_version (30s)".to_string())?
    .map_err(|_| "response channel closed".to_string())?;

    eprintln!("[katago_initialize] got version response: {}", &version_response[..version_response.len().min(200)]);

    // Parse version — check for error first
    let version_json: serde_json::Value = serde_json::from_str(&version_response)
        .map_err(|e| format!("failed to parse version: {}", e))?;

    // Check if KataGo returned an error instead of version info
    if let Some(err) = version_json.get("error").and_then(|v| v.as_str()) {
        let mut katago = lock_katago(state.inner())?;
        if let Some(ref mut p) = *katago { p.status = KataGoStatus::Failed; }
        return Err(format!("KataGo startup failed: {}", err));
    }

    let version = version_json
        .get("version")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();
    let git_hash = version_json
        .get("git_hash")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // Update status to Ready
    {
        let mut katago = lock_katago(state.inner())?;
        if let Some(ref mut process) = *katago {
            process.status = KataGoStatus::Ready;
        }
    }

    eprintln!("[katago_initialize] SUCCESS — KataGo v{} ready", version);

    Ok(VersionInfo { version, git_hash })
}

#[tauri::command]
pub async fn katago_shutdown(state: State<'_, AppState>) -> Result<(), String> {
    let (shutdown_tx, stdin_arc) = {
        let mut katago = lock_katago(state.inner())?;
        if let Some(ref mut process) = *katago {
            process.status = KataGoStatus::Idle;
            let stdin = process.stdin.clone();
            (process.shutdown_tx.take(), Some(stdin))
        } else {
            (None, None)
        }
    };

    // Send terminate_all
    if let Some(stdin) = stdin_arc {
        let _ = write_stdin(&stdin, b"{\"id\":\"__shutdown__\",\"action\":\"terminate_all\"}\n");
    }

    if let Some(tx) = shutdown_tx {
        let _ = tx.send(()).await.ok();
    }

    {
        let mut katago = lock_katago(state.inner())?;
        *katago = None;
    }

    Ok(())
}

#[tauri::command]
pub async fn katago_analyze(
    state: State<'_, AppState>,
    query: AnalysisQuery,
) -> Result<AnalysisResponse, String> {
    let mut q = serde_json::json!({
        "id": query.id,
        "moves": query.moves,
        "rules": query.rules,
        "boardXSize": query.board_x_size,
        "boardYSize": query.board_y_size,
    });
    if let Some(komi) = query.komi { q["komi"] = serde_json::json!(komi); }
    if let Some(v) = query.max_visits { q["maxVisits"] = serde_json::json!(v); }
    if let Some(t) = query.root_policy_temperature { q["rootPolicyTemperature"] = serde_json::json!(t); }
    if let Some(o) = query.include_ownership { q["includeOwnership"] = serde_json::json!(o); }
    if let Some(ref t) = query.analyze_turns { q["analyzeTurns"] = serde_json::json!(t); }
    if let Some(p) = query.priority { q["priority"] = serde_json::json!(p); }
    if let Some(ref s) = query.initial_stones { q["initialStones"] = serde_json::json!(s); }
    if let Some(ref o) = query.override_settings { q["overrideSettings"] = o.clone(); }

    let query_json = serde_json::to_string(&q).map_err(|e| e.to_string())?;
    let query_line = format!("{}\n", query_json);

    // Register response channel and get stdin
    let (resp_tx, resp_rx) = oneshot::channel::<String>();
    let stdin_arc;
    let pending_arc;
    {
        let mut katago = lock_katago(state.inner())?;
        match *katago {
            None => return Err("KataGo not initialized".to_string()),
            Some(ref mut process) => {
                if !matches!(process.status, KataGoStatus::Ready | KataGoStatus::Analyzing) {
                    return Err(format!("KataGo not ready ({})", process.status));
                }
                process.status = KataGoStatus::Analyzing;
                stdin_arc = process.stdin.clone();
                pending_arc = process.pending_responses.clone();
            }
        }
    }

    // Register the response channel
    {
        let mut pending: tokio::sync::MutexGuard<'_, HashMap<String, oneshot::Sender<String>>> = pending_arc.lock().await;
        pending.insert(query.id.clone(), resp_tx);
    }

    // Write query to stdin (synchronous, outside std::sync::Mutex scope)
    write_stdin(&stdin_arc, query_line.as_bytes())
        .map_err(|e| format!("analyze write: {}", e))?;

    // Wait for response
    let timeout_secs = match query.max_visits {
        Some(v) if v <= 5 => 5,
        Some(v) if v <= 50 => 15,
        Some(v) if v <= 500 => 90,
        _ => 180,
    };

    let response_str = tokio::time::timeout(
        std::time::Duration::from_secs(timeout_secs),
        resp_rx,
    )
    .await
    .map_err(|_| format!("timeout after {}s for {}", timeout_secs, query.id))?
    .map_err(|_| format!("channel closed for {}", query.id))?;

    let response_json: serde_json::Value = serde_json::from_str(&response_str)
        .map_err(|e| format!("parse failed: {}", e))?;

    if let Some(error) = response_json.get("error").and_then(|v| v.as_str()) {
        {
            let mut katago = lock_katago(state.inner())?;
            if let Some(ref mut p) = *katago { p.status = KataGoStatus::Ready; p.failure_count += 1; }
        }
        return Err(format!("KataGo error: {}", error));
    }

    if response_json.get("noResults").and_then(|v| v.as_bool()) == Some(true) {
        {
            let mut katago = lock_katago(state.inner())?;
            if let Some(ref mut p) = *katago { p.status = KataGoStatus::Ready; }
        }
        return Ok(AnalysisResponse {
            id: query.id,
            turn_number: response_json.get("turnNumber").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
            move_infos: vec![], root_info: serde_json::json!({}), is_during_search: false,
            ownership: None, ownership_stdev: None, policy: None, human_policy: None,
            no_results: Some(true),
        });
    }

    let response = AnalysisResponse {
        id: response_json.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        turn_number: response_json.get("turnNumber").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
        move_infos: response_json.get("moveInfos").and_then(|v| v.as_array()).cloned().unwrap_or_default(),
        root_info: response_json.get("rootInfo").cloned().unwrap_or(serde_json::json!({})),
        is_during_search: response_json.get("isDuringSearch").and_then(|v| v.as_bool()).unwrap_or(false),
        ownership: response_json.get("ownership").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|v| v.as_f64()).collect()),
        ownership_stdev: response_json.get("ownershipStdev").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|v| v.as_f64()).collect()),
        policy: response_json.get("policy").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|v| v.as_f64()).collect()),
        human_policy: response_json.get("humanPolicy").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|v| v.as_f64()).collect()),
        no_results: None,
    };

    {
        let mut katago = lock_katago(state.inner())?;
        if let Some(ref mut p) = *katago { p.status = KataGoStatus::Ready; p.failure_count = 0; }
    }

    Ok(response)
}

#[tauri::command]
pub async fn katago_cancel(state: State<'_, AppState>, query_id: String) -> Result<(), String> {
    let stdin = {
        let katago = lock_katago(state.inner())?;
        match &*katago {
            Some(p) => p.stdin.clone(),
            None => return Ok(()),
        }
    };
    let msg = format!("{{\"id\":\"term-{}\",\"action\":\"terminate\",\"terminateId\":\"{}\"}}\n", query_id, query_id);
    write_stdin(&stdin, msg.as_bytes())
}

#[tauri::command]
pub async fn katago_cancel_all(state: State<'_, AppState>) -> Result<(), String> {
    let stdin = {
        let katago = lock_katago(state.inner())?;
        match &*katago {
            Some(p) => p.stdin.clone(),
            None => return Ok(()),
        }
    };
    write_stdin(&stdin, b"{\"id\":\"term-all\",\"action\":\"terminate_all\"}\n")
}

#[tauri::command]
pub fn katago_get_status(state: State<'_, AppState>) -> KataGoStatus {
    let katago = state.katago.lock().unwrap_or_else(|e| e.into_inner());
    match &*katago {
        None => KataGoStatus::Idle,
        Some(p) => p.status.clone(),
    }
}

#[tauri::command]
pub async fn katago_detect_backend() -> Result<BackendInfo, String> {
    let arch = std::env::consts::ARCH;
    match std::env::consts::OS {
        "macos" if arch == "aarch64" => Ok(BackendInfo {
            backend_type: "metal".into(), device_name: "Apple Silicon GPU".into(), binary_name: "katago-metal".into(),
        }),
        "macos" => Ok(BackendInfo {
            backend_type: "opencl".into(), device_name: "Intel GPU".into(), binary_name: "katago-opencl".into(),
        }),
        _ => Ok(BackendInfo {
            backend_type: "opencl".into(), device_name: "GPU".into(), binary_name: "katago-opencl".into(),
        }),
    }
}
