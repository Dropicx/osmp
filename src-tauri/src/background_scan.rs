use crate::database::Database;
use crate::scanner::ScannerWithProgress;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tracing::{info, warn, error};

pub fn start_background_scanning(
    app_handle: AppHandle,
    db: Database,
    scan_running: Arc<AtomicBool>,
    scan_cancelled: Arc<AtomicBool>,
) {
    tauri::async_runtime::spawn(async move {
        // Read settings from DB
        let (scan_on_startup, periodic_enabled, interval_minutes) = {
            match db.lock() {
                Ok(db_lock) => {
                    let startup = db_lock.get_setting("scan_on_startup")
                        .ok()
                        .flatten()
                        .map(|v| v == "true")
                        .unwrap_or(true);
                    let periodic = db_lock.get_setting("periodic_scan_enabled")
                        .ok()
                        .flatten()
                        .map(|v| v == "true")
                        .unwrap_or(true);
                    let interval = db_lock.get_setting("periodic_scan_interval_minutes")
                        .ok()
                        .flatten()
                        .and_then(|v| v.parse::<u64>().ok())
                        .unwrap_or(30);
                    (startup, periodic, interval)
                }
                Err(e) => {
                    error!("Failed to lock database for background scan settings: {}", e);
                    return;
                }
            }
        };

        // Startup scan after a short delay so the window is ready
        if scan_on_startup {
            tokio::time::sleep(std::time::Duration::from_secs(3)).await;
            run_background_scan(&app_handle, &db, &scan_running, &scan_cancelled).await;
        }

        // Periodic scan
        if periodic_enabled && interval_minutes > 0 {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(interval_minutes * 60));
            // First tick fires immediately — skip it since we may have just done a startup scan
            interval.tick().await;

            loop {
                interval.tick().await;
                run_background_scan(&app_handle, &db, &scan_running, &scan_cancelled).await;
            }
        }
    });
}

async fn run_background_scan(
    app_handle: &AppHandle,
    db: &Database,
    scan_running: &Arc<AtomicBool>,
    scan_cancelled: &Arc<AtomicBool>,
) {
    // Try to acquire the scan lock; skip if a manual scan is in progress
    if scan_running.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
        info!("Background scan skipped: another scan is already running");
        return;
    }

    // Get enabled folders
    let enabled_folders: Vec<String> = match db.lock() {
        Ok(db_lock) => {
            match db_lock.get_scan_folders() {
                Ok(folders) => folders.into_iter()
                    .filter(|f| f.enabled)
                    .map(|f| f.path)
                    .collect(),
                Err(e) => {
                    warn!("Background scan: failed to get scan folders: {}", e);
                    scan_running.store(false, Ordering::SeqCst);
                    return;
                }
            }
        }
        Err(e) => {
            warn!("Background scan: database lock error: {}", e);
            scan_running.store(false, Ordering::SeqCst);
            return;
        }
    };

    if enabled_folders.is_empty() {
        scan_running.store(false, Ordering::SeqCst);
        return;
    }

    let db_clone = Arc::clone(db);
    let scan_cancelled_clone = Arc::clone(scan_cancelled);
    let scan_running_clone = Arc::clone(scan_running);
    let app_handle_clone = app_handle.clone();

    // Run the scanner in a blocking thread (quiet mode)
    let result = tokio::task::spawn_blocking(move || {
        let scanner = ScannerWithProgress::new_quiet(db_clone, app_handle_clone, scan_cancelled_clone);
        let result = scanner.scan_with_progress(enabled_folders);
        scan_running_clone.store(false, Ordering::SeqCst);
        result
    }).await;

    match result {
        Ok(Ok(scan_result)) => {
            if scan_result.scanned > 0 {
                info!("Background scan found {} new tracks", scan_result.scanned);
                let _ = app_handle.emit("library-updated", scan_result.scanned);
            } else {
                info!("Background scan complete: library is up to date");
            }
        }
        Ok(Err(e)) => {
            warn!("Background scan error: {}", e);
        }
        Err(e) => {
            warn!("Background scan task error: {}", e);
        }
    }
}
