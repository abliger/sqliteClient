#[allow(unused_imports)]
use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug, Clone)]
pub enum AppError {
    #[error("Connection error: {0}")]
    ConnectionError(String),

    #[error("Query error: {0}")]
    QueryError(String),

    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("IO error: {0}")]
    IoError(String),

    #[error("File error: {0}")]
    FileError(String),

    #[error("Invalid parameter: {0}")]
    InvalidParameter(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[allow(dead_code)]
    #[error("Operation cancelled")]
    Cancelled,

    #[error("Internal error: {0}")]
    InternalError(String),
}

pub type AppResult<T> = Result<T, AppError>;

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        AppError::DatabaseError(err.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::IoError(err.to_string())
    }
}

impl From<r2d2::Error> for AppError {
    fn from(err: r2d2::Error) -> Self {
        AppError::ConnectionError(err.to_string())
    }
}

impl From<csv::Error> for AppError {
    fn from(err: csv::Error) -> Self {
        AppError::IoError(err.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::InternalError(err.to_string())
    }
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_error_display() {
        let err = AppError::ConnectionError("test error".to_string());
        assert_eq!(err.to_string(), "Connection error: test error");

        let err = AppError::QueryError("query failed".to_string());
        assert_eq!(err.to_string(), "Query error: query failed");

        let err = AppError::DatabaseError("db error".to_string());
        assert_eq!(err.to_string(), "Database error: db error");

        let err = AppError::IoError("io error".to_string());
        assert_eq!(err.to_string(), "IO error: io error");

        let err = AppError::InvalidParameter("param".to_string());
        assert_eq!(err.to_string(), "Invalid parameter: param");

        let err = AppError::NotFound("item".to_string());
        assert_eq!(err.to_string(), "Not found: item");

        let err = AppError::Cancelled;
        assert_eq!(err.to_string(), "Operation cancelled");

        let err = AppError::InternalError("internal".to_string());
        assert_eq!(err.to_string(), "Internal error: internal");
    }

    #[test]
    fn test_app_error_from_rusqlite() {
        let rusqlite_err = rusqlite::Error::InvalidQuery;
        let app_err: AppError = rusqlite_err.into();
        assert!(matches!(app_err, AppError::DatabaseError(_)));
    }

    #[test]
    fn test_app_error_from_io() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let app_err: AppError = io_err.into();
        assert!(matches!(app_err, AppError::IoError(_)));
    }

    #[test]
    fn test_app_error_serialize() {
        let err = AppError::ConnectionError("test".to_string());
        let serialized = serde_json::to_string(&err).unwrap();
        assert_eq!(serialized, "\"Connection error: test\"");
    }

    #[test]
    fn test_app_result_type() {
        let result: AppResult<i32> = Ok(42);
        assert!(result.is_ok());

        let result: AppResult<i32> = Err(AppError::NotFound("test".to_string()));
        assert!(result.is_err());
    }
}
