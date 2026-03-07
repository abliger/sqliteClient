use tauri::{State, Manager};
use serde::{Serialize, Deserialize};
use std::fs;
use std::path::PathBuf;

use crate::utils::error::{AppError, AppResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub locale: String,
    pub theme: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            locale: "en".to_string(),
            theme: "auto".to_string(),
        }
    }
}

pub struct SettingsStore {
    config_dir: PathBuf,
}

impl SettingsStore {
    pub fn new(app_handle: &tauri::AppHandle) -> AppResult<Self> {
        let config_dir = app_handle
            .path()
            .app_config_dir()
            .map_err(|e| AppError::IoError(e.to_string()))?;
        
        // Ensure config directory exists
        fs::create_dir_all(&config_dir)?;
        
        Ok(Self { config_dir })
    }

    fn settings_path(&self) -> PathBuf {
        self.config_dir.join("settings.json")
    }

    pub fn get_settings(&self) -> AppResult<AppSettings> {
        let path = self.settings_path();
        
        if !path.exists() {
            return Ok(AppSettings::default());
        }

        let content = fs::read_to_string(&path)?;
        let settings: AppSettings = serde_json::from_str(&content)?;
        Ok(settings)
    }

    pub fn save_settings(&self, settings: &AppSettings) -> AppResult<()> {
        let path = self.settings_path();
        let content = serde_json::to_string_pretty(settings)?;
        fs::write(&path, content)?;
        Ok(())
    }
}

#[tauri::command]
pub async fn get_app_settings(
    settings_store: State<'_, SettingsStore>,
) -> AppResult<Option<AppSettings>> {
    match settings_store.get_settings() {
        Ok(settings) => Ok(Some(settings)),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
pub async fn save_app_settings(
    settings_store: State<'_, SettingsStore>,
    settings: AppSettings,
) -> AppResult<()> {
    settings_store.save_settings(&settings)
}
