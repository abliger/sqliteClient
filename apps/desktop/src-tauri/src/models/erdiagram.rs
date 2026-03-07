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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_er_diagram_serialization() {
        let diagram = ERDiagram {
            tables: vec![TableNode {
                id: "table-1".to_string(),
                name: "users".to_string(),
                x: 100.0,
                y: 100.0,
                width: 200.0,
                height: 300.0,
                columns: vec![ColumnNode {
                    name: "id".to_string(),
                    data_type: "INTEGER".to_string(),
                    is_primary_key: true,
                    is_foreign_key: false,
                    nullable: false,
                }],
            }],
            relations: vec![RelationEdge {
                id: "rel-1".to_string(),
                from_table: "users".to_string(),
                from_column: "id".to_string(),
                to_table: "orders".to_string(),
                to_column: "user_id".to_string(),
                relation_type: RelationType::OneToMany,
            }],
        };

        let json = serde_json::to_string(&diagram).unwrap();
        let deserialized: ERDiagram = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.tables.len(), 1);
        assert_eq!(deserialized.relations.len(), 1);
    }

    #[test]
    fn test_table_node_serialization() {
        let node = TableNode {
            id: "table-1".to_string(),
            name: "users".to_string(),
            x: 100.0,
            y: 100.0,
            width: 200.0,
            height: 300.0,
            columns: vec![],
        };

        let json = serde_json::to_string(&node).unwrap();
        let deserialized: TableNode = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.id, "table-1");
        assert_eq!(deserialized.name, "users");
        assert_eq!(deserialized.x, 100.0);
    }

    #[test]
    fn test_column_node_serialization() {
        let node = ColumnNode {
            name: "id".to_string(),
            data_type: "INTEGER".to_string(),
            is_primary_key: true,
            is_foreign_key: false,
            nullable: false,
        };

        let json = serde_json::to_string(&node).unwrap();
        assert!(json.contains("is_primary_key"));

        let deserialized: ColumnNode = serde_json::from_str(&json).unwrap();
        assert!(deserialized.is_primary_key);
        assert!(!deserialized.is_foreign_key);
    }

    #[test]
    fn test_relation_edge_serialization() {
        let edge = RelationEdge {
            id: "rel-1".to_string(),
            from_table: "users".to_string(),
            from_column: "id".to_string(),
            to_table: "orders".to_string(),
            to_column: "user_id".to_string(),
            relation_type: RelationType::OneToMany,
        };

        let json = serde_json::to_string(&edge).unwrap();
        let deserialized: RelationEdge = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.from_table, "users");
        assert_eq!(deserialized.to_table, "orders");
    }

    #[test]
    fn test_relation_type_serialization() {
        let one_to_one = serde_json::to_string(&RelationType::OneToOne).unwrap();
        assert_eq!(one_to_one, "\"onetoone\"");

        let one_to_many = serde_json::to_string(&RelationType::OneToMany).unwrap();
        assert_eq!(one_to_many, "\"onetomany\"");

        let many_to_many = serde_json::to_string(&RelationType::ManyToMany).unwrap();
        assert_eq!(many_to_many, "\"manytomany\"");
    }
}
