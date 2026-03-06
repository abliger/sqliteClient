use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ERDiagram {
    pub tables: Vec<TableNode>,
    pub relations: Vec<RelationEdge>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableNode {
    pub id: String,
    pub name: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub columns: Vec<ColumnNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnNode {
    pub name: String,
    pub data_type: String,
    pub is_primary_key: bool,
    pub is_foreign_key: bool,
    pub nullable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelationEdge {
    pub id: String,
    pub from_table: String,
    pub from_column: String,
    pub to_table: String,
    pub to_column: String,
    pub relation_type: RelationType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RelationType {
    OneToOne,
    OneToMany,
    ManyToMany,
}
