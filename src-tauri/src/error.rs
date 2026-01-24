use std::fmt;

#[derive(Debug)]
pub enum OsmpError {
    Database(String),
    Io(std::io::Error),
    Audio(String),
    Metadata(String),
    LockPoisoned(String),
    NotFound(String),
}

impl fmt::Display for OsmpError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            OsmpError::Database(msg) => write!(f, "Database error: {}", msg),
            OsmpError::Io(err) => write!(f, "I/O error: {}", err),
            OsmpError::Audio(msg) => write!(f, "Audio error: {}", msg),
            OsmpError::Metadata(msg) => write!(f, "Metadata error: {}", msg),
            OsmpError::LockPoisoned(msg) => write!(f, "Lock error: {}", msg),
            OsmpError::NotFound(msg) => write!(f, "Not found: {}", msg),
        }
    }
}

impl std::error::Error for OsmpError {}

impl From<std::io::Error> for OsmpError {
    fn from(err: std::io::Error) -> Self {
        OsmpError::Io(err)
    }
}

impl From<rusqlite::Error> for OsmpError {
    fn from(err: rusqlite::Error) -> Self {
        OsmpError::Database(err.to_string())
    }
}

impl From<anyhow::Error> for OsmpError {
    fn from(err: anyhow::Error) -> Self {
        OsmpError::Database(err.to_string())
    }
}

// Convert to String for Tauri command error responses
impl From<OsmpError> for String {
    fn from(err: OsmpError) -> Self {
        err.to_string()
    }
}
