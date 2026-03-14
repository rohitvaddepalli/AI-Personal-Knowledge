#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{fs, sync::Mutex, time::Duration};

use serde::Serialize;
use tauri::{
    menu::{Menu, PredefinedMenuItem, Submenu},
    AppHandle, Manager, Runtime, State,
};
use tauri_plugin_shell::{process::CommandChild, ShellExt};

const SIDECAR_HOST: &str = "127.0.0.1";
const SIDECAR_NAME: &str = "sidecar-python";
const SIDECAR_PORT: u16 = 31415;

struct SidecarState(Mutex<Option<CommandChild>>);

#[derive(Serialize)]
struct DesktopRuntime {
    apiBaseUrl: String,
    appDataDir: String,
}

#[tauri::command]
fn get_desktop_runtime(app: AppHandle) -> Result<DesktopRuntime, String> {
    let app_data_dir = ensure_app_data_dir(&app).map_err(|err| err.to_string())?;

    Ok(DesktopRuntime {
        apiBaseUrl: format!("http://{SIDECAR_HOST}:{SIDECAR_PORT}"),
        appDataDir: app_data_dir.to_string_lossy().to_string(),
    })
}

fn ensure_app_data_dir<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<std::path::PathBuf> {
    let app_data_dir = app.path().app_data_dir()?;
    fs::create_dir_all(&app_data_dir)?;
    Ok(app_data_dir)
}

fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &PredefinedMenuItem::close_window(app, Some("Close"))?,
            &PredefinedMenuItem::quit(app, Some("Quit"))?,
        ],
    )?;

    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, Some("Undo"))?,
            &PredefinedMenuItem::redo(app, Some("Redo"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, Some("Cut"))?,
            &PredefinedMenuItem::copy(app, Some("Copy"))?,
            &PredefinedMenuItem::paste(app, Some("Paste"))?,
            &PredefinedMenuItem::select_all(app, Some("Select All"))?,
        ],
    )?;

    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &PredefinedMenuItem::fullscreen(app, Some("Toggle Fullscreen"))?,
            &PredefinedMenuItem::minimize(app, Some("Minimize"))?,
        ],
    )?;

    Menu::with_items(app, &[&file_menu, &edit_menu, &view_menu])
}

fn spawn_sidecar<R: Runtime>(app: &AppHandle<R>, state: State<SidecarState>) -> tauri::Result<()> {
    let app_data_dir = ensure_app_data_dir(app)?;

    let command = app
        .shell()
        .sidecar(SIDECAR_NAME)?
        .args([
            "--host",
            SIDECAR_HOST,
            "--port",
            &SIDECAR_PORT.to_string(),
            "--data-dir",
            &app_data_dir.to_string_lossy(),
        ]);

    let (_receiver, child) = command.spawn()?;
    let mut lock = state.0.lock().expect("sidecar state lock");
    *lock = Some(child);

    Ok(())
}

fn stop_sidecar<R: Runtime>(state: State<SidecarState>) {
    let shutdown_url = format!("http://{SIDECAR_HOST}:{SIDECAR_PORT}/api/system/shutdown");
    let _ = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .and_then(|client| client.post(shutdown_url).send());

    std::thread::sleep(Duration::from_millis(400));

    if let Some(mut child) = state.0.lock().expect("sidecar state lock").take() {
        let _ = child.kill();
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(SidecarState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![get_desktop_runtime])
        .setup(|app| {
            let menu = build_menu(&app.handle())?;
            app.set_menu(menu)?;
            let state = app.state::<SidecarState>();
            spawn_sidecar(&app.handle(), state)?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                let state = app.state::<SidecarState>();
                stop_sidecar(state);
            }
        });
}
