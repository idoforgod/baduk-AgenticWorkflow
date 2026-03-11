// =============================================================================
// katago.rs — KataGo Process Lifecycle Types
// =============================================================================
// Uses std::process (not tokio::process) to avoid async runtime panics.
// Stdout/stderr readers run on OS threads (std::thread::spawn).
// Stdin writes are synchronous via std::sync::Mutex.
// =============================================================================

use std::collections::HashMap;
use std::io::Write;
use std::process::ChildStdin;
use std::sync::{Arc, Mutex as StdMutex};
use tokio::sync::{mpsc, oneshot, Mutex as TokioMutex};

/// Wraps the spawned KataGo process.
pub struct KataGoProcess {
    /// Stdin writer (synchronous) — protected by std Mutex for thread safety
    pub stdin: Arc<StdMutex<ChildStdin>>,
    /// Current lifecycle status
    pub status: KataGoStatus,
    /// Map of pending query IDs to their response channels
    pub pending_responses: Arc<TokioMutex<HashMap<String, oneshot::Sender<String>>>>,
    /// Channel to signal the stdout reader thread to stop
    pub shutdown_tx: Option<mpsc::Sender<()>>,
    /// Process start time (Unix epoch seconds)
    pub start_time: u64,
    /// Recent stderr lines (ring buffer, max 50 lines)
    pub stderr_buffer: Arc<StdMutex<Vec<String>>>,
    /// Number of consecutive failures
    pub failure_count: u32,
}

/// Synchronous stdin write helper — used by all command handlers.
pub fn write_stdin(stdin: &Arc<StdMutex<ChildStdin>>, data: &[u8]) -> Result<(), String> {
    let mut stdin = stdin
        .lock()
        .map_err(|e| format!("stdin lock poisoned: {}", e))?;
    stdin
        .write_all(data)
        .map_err(|e| format!("stdin write failed: {}", e))?;
    stdin
        .flush()
        .map_err(|e| format!("stdin flush failed: {}", e))?;
    Ok(())
}

/// KataGo lifecycle state machine.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum KataGoStatus {
    Idle,
    Starting,
    Ready,
    Analyzing,
    Degraded,
    Failed,
    Restarting,
    Fallback,
}

impl std::fmt::Display for KataGoStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            KataGoStatus::Idle => write!(f, "Idle"),
            KataGoStatus::Starting => write!(f, "Starting"),
            KataGoStatus::Ready => write!(f, "Ready"),
            KataGoStatus::Analyzing => write!(f, "Analyzing"),
            KataGoStatus::Degraded => write!(f, "Degraded"),
            KataGoStatus::Failed => write!(f, "Failed"),
            KataGoStatus::Restarting => write!(f, "Restarting"),
            KataGoStatus::Fallback => write!(f, "Fallback"),
        }
    }
}
