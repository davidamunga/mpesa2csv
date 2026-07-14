/// Shared state that holds the PID of the currently running Java/Tabula process
/// so it can be killed if the frontend times out.
pub struct ActivePid(pub std::sync::Mutex<Option<u32>>);

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn cancel_pdf_extraction(active_pid: tauri::State<'_, ActivePid>) {
    let pid = active_pid.0.lock().unwrap().take();
    if let Some(pid) = pid {
        #[cfg(unix)]
        {
            std::process::Command::new("kill")
                .args(["-9", &pid.to_string()])
                .output()
                .ok();
        }
        #[cfg(windows)]
        {
            std::process::Command::new("taskkill")
                .args(["/F", "/PID", &pid.to_string()])
                .output()
                .ok();
        }
    }
}

#[cfg(target_os = "windows")]
fn normalize_windows_path(path: std::path::PathBuf) -> std::path::PathBuf {
    use std::path::PathBuf;
    
    let path_str = path.to_string_lossy().to_string();
    
    if path_str.starts_with(r"\\?\") {
        PathBuf::from(path_str.trim_start_matches(r"\\?\"))
    } else {
        path
    }
}

#[cfg(not(target_os = "windows"))]
fn normalize_windows_path(path: std::path::PathBuf) -> std::path::PathBuf {
    path
}

#[tauri::command]
async fn extract_pdf_tables(
    app_handle: tauri::AppHandle,
    active_pid: tauri::State<'_, ActivePid>,
    pdf_path: String,
    output_path: String,
    password: Option<String>,
) -> Result<String, String> {
    use std::process::Command;
    use tauri::Manager;
    
    #[cfg(target_os = "windows")]
    use std::os::windows::process::CommandExt;

    let jar_path = app_handle
        .path()
        .resolve("tabula-1.0.5-jar-with-dependencies.jar", tauri::path::BaseDirectory::Resource)
        .map_err(|e| format!("Failed to resolve JAR: {}", e))?;
    
    let jar_path = normalize_windows_path(jar_path);
    
    let jre_folder = if cfg!(target_os = "windows") {
        "build-jre/jre-windows-x64"
    } else if cfg!(all(target_os = "macos", target_arch = "x86_64")) {
        "build-jre/jre-macos-x64"
    } else if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        "build-jre/jre-macos-arm64"
    } else if cfg!(all(target_os = "linux", target_arch = "x86_64")) {
        "build-jre/jre-linux-x64"
    } else if cfg!(all(target_os = "linux", target_arch = "aarch64")) {
        "build-jre/jre-linux-arm64"
    } else {
        return Err(format!("Unsupported platform: {} {}", std::env::consts::OS, std::env::consts::ARCH));
    };
    
    let jre_path = app_handle
        .path()
        .resolve(jre_folder, tauri::path::BaseDirectory::Resource)
        .map_err(|e| format!("Failed to resolve JRE at {}: {}", jre_folder, e))?;
    
    // Try multiple possible locations for Java binary
    // jlink-created JREs have a simpler structure than full macOS JREs
    let java_binary = if cfg!(target_os = "macos") {
        let jlink_path = jre_path.join("bin").join("java");
        let full_path = jre_path.join("Contents").join("Home").join("bin").join("java");
        
        if jlink_path.exists() {
            jlink_path
        } else {
            full_path
        }
    } else {
        jre_path.join("bin").join(
            if cfg!(target_os = "windows") { "java.exe" } else { "java" }
        )
    };
    
    // Check if java binary exists and provide helpful error
    let (mut cmd, java_source) = if java_binary.exists() {
        let command = Command::new(&java_binary);
        #[cfg(target_os = "windows")]
        {
            // Hide console window on Windows (CREATE_NO_WINDOW flag)
            let mut command = command;
            command.creation_flags(0x08000000);
            (command, format!("bundled JRE at {:?}", java_binary))
        }
        #[cfg(not(target_os = "windows"))]
        {
            (command, format!("bundled JRE at {:?}", java_binary))
        }
    } else {
        // Fallback to system Java
        let command = Command::new("java");
        #[cfg(target_os = "windows")]
        {
            // Hide console window on Windows (CREATE_NO_WINDOW flag)
            let mut command = command;
            command.creation_flags(0x08000000);
            (command, "system PATH (bundled JRE not found)".to_string())
        }
        #[cfg(not(target_os = "windows"))]
        {
            (command, "system PATH (bundled JRE not found)".to_string())
        }
    };
    
    let normalized_pdf_path = if cfg!(target_os = "windows") {
        use std::path::PathBuf;
        let path_str = pdf_path.trim_start_matches(r"\\?\");
        PathBuf::from(path_str)
    } else {
        std::path::PathBuf::from(&pdf_path)
    };
    
    let normalized_output_path = if cfg!(target_os = "windows") {
        use std::path::PathBuf;
        let path_str = output_path.trim_start_matches(r"\\?\");
        PathBuf::from(path_str)
    } else {
        std::path::PathBuf::from(&output_path)
    };
    
    cmd.arg("-jar")
        .arg(&jar_path)
        .arg(&normalized_pdf_path)
        .arg("--format=CSV")
        .arg("--outfile")
        .arg(&normalized_output_path)
        .arg("--pages")
        .arg("all");
    
    if let Some(pwd) = password {
        cmd.arg("--password").arg(pwd);
    }
    
    let child = cmd
        .spawn()
        .map_err(|e| {
            format!(
                "Failed to execute Java (using {}): {}\n\
                Expected bundled Java at: {:?}\n\
                JRE folder checked: {:?}\n\
                JAR path: {:?}\n\
                Error: {}",
                java_source,
                if e.kind() == std::io::ErrorKind::NotFound {
                    "Java executable not found. Please ensure Java is installed or the bundled JRE is properly configured."
                } else {
                    "Execution error"
                },
                java_binary,
                jre_path,
                jar_path,
                e
            )
        })?;

    // Store the PID so cancel_pdf_extraction can kill this process if the
    // frontend times out.
    let pid = child.id();
    *active_pid.0.lock().unwrap() = Some(pid);

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed waiting for Java process: {}", e))?;

    // Clear the PID — process has finished.
    {
        let mut guard = active_pid.0.lock().unwrap();
        if *guard == Some(pid) {
            *guard = None;
        }
    }
    
    if output.status.success() {
        Ok(format!("Tables extracted successfully to: {}", output_path))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        Err(format!("Tabula error:\nStderr: {}\nStdout: {}", stderr, stdout))
    }
}

#[tauri::command]
async fn save_csv_file(
    app: tauri::AppHandle,
    csv_content: String,
    default_filename: String,
) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;
    use std::fs;

    let file_path = app
        .dialog()
        .file()
        .set_title("Save CSV File")
        .add_filter("CSV Files", &["csv"])
        .set_file_name(&default_filename)
        .blocking_save_file();

    match file_path {
        Some(path) => {
            let path_buf = path.as_path().unwrap();
            
            match fs::write(&path_buf, &csv_content) {
                Ok(_) => Ok(format!("File saved successfully to: {}", path_buf.display())),
                Err(e) => Err(format!("Failed to write file: {}", e)),
            }
        }
        None => Err("Save dialog was cancelled".to_string()),
    }
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
async fn open_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    
    match std::path::Path::new(&path).exists() {
        true => {
            if let Err(e) = app.opener().open_url(format!("file://{}", path), None::<&str>) {
                Err(format!("Failed to open file: {}", e))
            } else {
                Ok(())
            }
        }
        false => Err("File not found".to_string())
    }
}

#[tauri::command]
async fn save_file(
    app: tauri::AppHandle,
    content: Vec<u8>,
    default_filename: String,
    _file_type: String,
) -> Result<String, String> {
    #[cfg(not(mobile))]
    let (title, filter_name, extensions) = match _file_type.as_str() {
        "csv" => ("Save CSV File", "CSV Files", vec!["csv"]),
        "xlsx" => ("Save Excel File", "Excel Files", vec!["xlsx"]),
        "json" => ("Save JSON File", "JSON Files", vec!["json"]),
        "ofx" => ("Save OFX File", "OFX Files", vec!["ofx"]),
        "qfx" => ("Save QFX File", "QFX Files", vec!["qfx"]),
        "qif" => ("Save QIF File", "QIF Files", vec!["qif"]),
        _ => return Err("Unsupported file type".to_string()),
    };

    
    #[cfg(mobile)]
    {
        use tauri::path::BaseDirectory;
        use tauri::Manager;
        use std::fs;
        
        
        #[cfg(target_os = "android")]
        {
            use std::path::PathBuf;
            
            let possible_paths = vec![
                PathBuf::from("/storage/emulated/0/Download").join(&default_filename),
                PathBuf::from("/storage/emulated/0/Downloads").join(&default_filename),
                PathBuf::from("/sdcard/Download").join(&default_filename),
                PathBuf::from("/sdcard/Downloads").join(&default_filename),
            ];
            
            let mut last_error = String::new();
            
            for download_path in possible_paths {
                if let Some(parent) = download_path.parent() {
                    if parent.exists() || fs::create_dir_all(parent).is_ok() {
                        match fs::write(&download_path, &content) {
                            Ok(_) => return Ok(format!("File saved successfully to: {}", download_path.display())),
                            Err(e) => last_error = format!("Failed to write to {}: {}", download_path.display(), e),
                        }
                    }
                }
            }
            
            match app.path().resolve(&default_filename, BaseDirectory::Download) {
                Ok(path) => {
                    if let Some(parent) = path.parent() {
                        let _ = fs::create_dir_all(parent);
                    }
                    match fs::write(&path, &content) {
                        Ok(_) => Ok(format!("File saved successfully to: {}", path.display())),
                        Err(e) => Err(format!("Failed to save file after trying all locations. Last error: {}", e))
                    }
                },
                Err(e) => Err(format!("Failed to resolve any download path. Errors: {} | {}", last_error, e))
            }
        }
        
        #[cfg(not(target_os = "android"))]
        {
            
            let docs_dir = match app.path().resolve(&default_filename, BaseDirectory::Download) {
                Ok(path) => path,
                Err(e) => return Err(format!("Failed to resolve document path: {}", e))
            };
            
            
            match fs::write(&docs_dir, &content) {
                Ok(_) => Ok(format!("File saved successfully to: {}", docs_dir.display())),
                Err(e) => Err(format!("Failed to save file: {}", e))
            }
        }
    }
    
    #[cfg(not(mobile))]
    {
        use tauri_plugin_dialog::DialogExt;
        use std::fs;
        
        let file_path = app
            .dialog()
            .file()
            .set_title(title)
            .add_filter(filter_name, &extensions)
            .set_file_name(&default_filename)
            .blocking_save_file();


        match file_path {
            Some(path) => {
                let path_buf = path.as_path().unwrap();
                
                
                match fs::write(&path_buf, &content) {
                    Ok(_) => Ok(format!("File saved successfully to: {}", path_buf.display())),
                    Err(e) => Err(format!("Failed to write file: {}", e))
                }
            }
            None => {
                Err("Save dialog was cancelled".to_string())
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ActivePid(std::sync::Mutex::new(None)))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![greet, extract_pdf_tables, cancel_pdf_extraction, save_csv_file, save_file, get_app_version, open_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}