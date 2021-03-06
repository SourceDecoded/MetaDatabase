"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _dataTypeMapping = require("./dataTypeMapping");

var _dataTypeMapping2 = _interopRequireDefault(_dataTypeMapping);

var _TableNameHelper = require("./TableNameHelper");

var _TableNameHelper2 = _interopRequireDefault(_TableNameHelper);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var defaultRelationships = {
    oneToOne: [],
    oneToMany: []
};

var TableStatementBuilder = function () {
    function TableStatementBuilder(table, options) {
        _classCallCheck(this, TableStatementBuilder);

        this.dataTypeMapping = _dataTypeMapping2.default;
        this.table = table;
        this.edm = options.edm;
        this.schema = options.schema;
        this.namer = new _TableNameHelper2.default({ edm: options.edm, schema: options.schema });
    }

    _createClass(TableStatementBuilder, [{
        key: "_escapeName",
        value: function _escapeName(name) {
            return "[" + name + "]";
        }
    }, {
        key: "_wrapIfTableExists",
        value: function _wrapIfTableExists(table, query) {
            return "IF NOT (EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES \n            WHERE TABLE_SCHEMA = '" + this.schema + "' AND TABLE_NAME = '" + this.namer.getTablePart(table.name) + "'))\n            BEGIN\n            " + query + "\n            END";
        }
    }, {
        key: "getQualifiedDbTableName",
        value: function getQualifiedDbTableName() {
            return namer.getQualifiedTableName(table.name);
        }
    }, {
        key: "createDropTableStatement",
        value: function createDropTableStatement() {
            return "IF OBJECT_ID('" + this.schema + "." + this.namer.getTablePart(this.table.name) + "', 'U') IS NOT NULL DROP TABLE " + this.namer.getQualifiedTableName(this.table.name) + ";";
        }
    }, {
        key: "createInsertStatement",
        value: function createInsertStatement(entity) {
            var _this = this;

            if (entity == null) {
                throw new Error("Null Argument Exception: entity cannot be null or undefined.");
            }

            var values = [];
            var columns = [];

            this.filterRelevantColumns(this.table.columns).forEach(function (column) {
                var columnName = column.name;
                var defaultValue = _this.getDefaultValue(column);

                if (typeof entity[columnName] !== "undefined" && entity[columnName] !== null) {
                    columns.push(_this._escapeName(columnName));

                    if (entity[columnName] === null) {
                        values.push(defaultValue);
                    } else {
                        values.push(entity[columnName]);
                    }
                }
            });

            var columnsStatement = columns.join(",");

            var valuesStatement = values.map(function (value, index) {
                return "@v" + index;
            });

            if (values.length === 0) {
                return {
                    statement: "INSERT INTO " + this.namer.getQualifiedTableName(this.table.name) + " () VALUES (); SELECT SCOPE_IDENTITY() AS id;",
                    values: values
                };
            }

            return {
                statement: "INSERT INTO " + this.namer.getQualifiedTableName(this.table.name) + " (" + columnsStatement + ") VALUES (" + valuesStatement + "); SELECT SCOPE_IDENTITY() AS id;",
                values: values
            };
        }
    }, {
        key: "createUpdateStatement",
        value: function createUpdateStatement(entity, delta) {
            var _this2 = this;

            var values = [];
            var primaryKeyExpr = [];
            var primaryKeyValues = [];
            var columnSet = [];
            var columns = this.table.columns;

            if (entity == null) {
                throw new Error("Null Argument Exception: entity cannot be null or undefined.");
            }

            if (delta == null) {
                throw new Error("Null Argument Exception: delta cannot be null or undefined.");
            }

            if (Object.keys(delta).length === 0) {
                throw new Error("Invalid Argument: delta cannot an empty object.");
            }

            var primaryKeys = this.getPrimaryKeys(columns);

            this.filterRelevantColumns(columns).filter(function (column) {
                return primaryKeys.indexOf(column.name) === -1;
            }).forEach(function (column) {
                var columnName = column.name;
                if (typeof delta[columnName] !== "undefined") {
                    columnSet.push(_this2._escapeName(columnName) + ("=@v" + values.length));
                    values.push(delta[columnName]);
                }
            });

            primaryKeys.forEach(function (key, index) {
                primaryKeyExpr.push(_this2._escapeName(key) + ("=@k" + index));
                primaryKeyValues.push(entity[key]);
            });

            return {
                statement: "UPDATE " + this.namer.getQualifiedTableName(this.table.name) + " SET " + columnSet.join(", ") + " WHERE " + primaryKeyExpr.join(" AND "),
                values: values,
                keys: primaryKeyValues
            };
        }
    }, {
        key: "createDeleteStatement",
        value: function createDeleteStatement(entity) {
            var _this3 = this;

            if (entity == null) {
                throw new Error("Null Argument Exception: entity cannot be null or undefined.");
            }

            var primaryKeysExpr = [];
            var keys = [];
            var primaryKeys = this.getPrimaryKeys(this.table.columns);

            primaryKeys.forEach(function (primaryKey, index) {

                if (entity[primaryKey] === null) {
                    primaryKeysExpr.push(_this3._escapeName(primaryKey) + " IS NULL");
                } else {
                    primaryKeysExpr.push(_this3._escapeName(primaryKey) + ("=@k" + keys.length));
                    keys.push(entity[primaryKey]);
                }
            });

            return {
                statement: "DELETE FROM " + this.namer.getQualifiedTableName(this.table.name) + " WHERE " + primaryKeysExpr.join(" AND "),
                keys: keys
            };
        }
    }, {
        key: "createColumnDefinitionStatement",
        value: function createColumnDefinitionStatement(column) {
            var sqlDataType = this.dataTypeMapping[column.type];
            var primaryKeyStatment = "";
            var primaryKeys = this.getPrimaryKeys(this.table.columns);

            if (sqlDataType != null) {
                var primaryKey = "";

                if (column.isPrimaryKey) {

                    if (primaryKeys.length === 1) {
                        primaryKey = " PRIMARY KEY";
                    }

                    if (column.isAutoIncrement) {
                        primaryKey += " IDENTITY(1,1)";
                    }
                }

                return this._escapeName(column.name) + " " + (this.dataTypeMapping[column.type] + primaryKey);
            } else {
                return null;
            }
        }
    }, {
        key: "createColumnsDefinitionStatement",
        value: function createColumnsDefinitionStatement() {
            var _this4 = this;

            var columns = this.table.columns || [];
            var columnsDefinition = columns.map(function (column) {
                return _this4.createColumnDefinitionStatement(column);
            }).filter(function (value) {
                return value != null;
            }).join(", ");

            return columnsDefinition;
        }
    }, {
        key: "createIndexStatement",
        value: function createIndexStatement(column) {
            return "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'" + this.namer.getQualifiedTableName(this.table.name) + "') AND name = N'index_" + column.replace(/\"/g, '""') + "')\n                  CREATE INDEX index_" + column.replace(/\"/g, '""') + " ON " + this.namer.getQualifiedTableName(this.table.name) + " (" + this._escapeName(column) + ")";
        }
    }, {
        key: "createTableIndexesStatements",
        value: function createTableIndexesStatements(relationships) {
            var _this5 = this;

            if (relationships == null) {
                throw new Error("Null Argument Exception: relationships cannot be null or undefined.");
            }

            var indexedColumns = {};

            var foreignKeyIndexes = this.getTablesRelationshipsAsTargets(relationships).forEach(function (relationship) {
                indexedColumns[relationship.withForeignKey] = true;
            });

            var primaryKeys = this.getPrimaryKeys(this.table.columns);

            this.getTablesRelationshipsAsSources(relationships).filter(function (relationship) {
                return primaryKeys.indexOf(relationship.hasKey) === -1;
            }).forEach(function (relationship) {
                return indexedColumns[relationship.hasKey] = true;
            });

            primaryKeys.forEach(function (name) {
                indexedColumns[name] = true;
            });

            this.table.columns.filter(function (column) {
                return column.isIndexed;
            }).map(function (column) {
                return indexedColumns[column.name];
            });

            return Object.keys(indexedColumns).map(function (columnName) {
                return _this5.createIndexStatement(columnName);
            });
        }
    }, {
        key: "createForeignKeysStatement",
        value: function createForeignKeysStatement(relationships) {
            var _this6 = this;

            var tableRelationships = this.getTablesRelationshipsAsTargets(relationships);

            return tableRelationships.map(function (relationship) {
                return _this6.createForeignKeyStatement(relationship);
            }).join("/n/t");
        }
    }, {
        key: "createForeignKeyStatement",
        value: function createForeignKeyStatement(relationship) {
            return "CONSTRAINT [c_" + relationship.ofType + "." + this.namer.getTablePart(relationship.withForeignKey) + "_to_" + this.namer.getTablePart(relationship.type) + "." + relationship.hasKey + "] FOREIGN KEY([" + this.namer.getTablePart(relationship.withForeignKey) + "]) REFERENCES " + this.namer.getQualifiedTableName(relationship.type) + " ([" + relationship.hasKey + "])";
        }
    }, {
        key: "createPrimaryKeyStatement",
        value: function createPrimaryKeyStatement() {
            var _this7 = this;

            var primaryKeys = this.getPrimaryKeys(this.table.columns).map(function (primaryKey) {
                return _this7._escapeName(primaryKey);
            });

            if (primaryKeys.length === 0) {
                return "";
            } else {
                return "PRIMARY KEY (" + primaryKeys.join(", ") + ")";
            }
        }
    }, {
        key: "createTableStatement",
        value: function createTableStatement() {
            var relationships = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            relationships = Object.assign({}, defaultRelationships, relationships);

            var columnDefinitionsStatement = this.createColumnsDefinitionStatement();
            // not sure we want to be enforcing these in the DB.
            //const foreignKeysStatement = this.createForeignKeysStatement(relationships);
            var foreignKeysStatement = "";

            if (columnDefinitionsStatement && foreignKeysStatement) {
                return this._wrapIfTableExists(this.table, "CREATE TABLE " + this.namer.getQualifiedTableName(this.table.name) + " (" + columnDefinitionsStatement + ", " + foreignKeysStatement + ")");
            } else if (columnDefinitionsStatement) {
                return this._wrapIfTableExists(this.table, "CREATE TABLE " + this.namer.getQualifiedTableName(this.table.name) + " (" + columnDefinitionsStatement + ")");
            } else {
                return this._wrapIfTableExists(this.table, "CREATE TABLE " + this.namer.getQualifiedTableName(this.table.name));
            }
        }
    }, {
        key: "filterRelevantColumns",
        value: function filterRelevantColumns(columns) {
            var _this8 = this;

            return columns.filter(function (column) {
                return _this8.dataTypeMapping[column.type] != null;
            });
        }
    }, {
        key: "getTablesRelationshipsAsTargets",
        value: function getTablesRelationshipsAsTargets(relationships) {
            var _this9 = this;

            var foreignKeyNames = {};

            var filter = function filter(relationship) {
                var foreignKey = relationship.withForeignKey;

                if (relationship.ofType === _this9.table.name && foreignKeyNames[foreignKey] == null) {
                    foreignKeyNames[foreignKey];
                    return true;
                }
                return false;
            };

            var oneToOne = relationships.oneToOne.filter(filter);
            var oneToMany = relationships.oneToMany.filter(filter);

            return oneToOne.concat(oneToMany);
        }
    }, {
        key: "getTablesRelationshipsAsSources",
        value: function getTablesRelationshipsAsSources(relationships) {
            var _this10 = this;

            var keyNames = {};

            var filter = function filter(relationship) {
                var key = relationship.hasKey;

                if (relationship.type === _this10.table.name && keyNames[key] == null) {
                    keyNames[key];
                    return true;
                }
                return false;
            };

            var oneToOne = relationships.oneToOne.filter(filter);
            var oneToMany = relationships.oneToMany.filter(filter);

            return oneToOne.concat(oneToMany);
        }
    }, {
        key: "getColumn",
        value: function getColumn(name) {
            return this.table.columns.find(function (column) {
                return column.name === name;
            });
        }
    }, {
        key: "getDefaultValue",
        value: function getDefaultValue(column) {
            return column["default" + column.type + "Value"] || null;
        }
    }, {
        key: "getPrimaryKeys",
        value: function getPrimaryKeys(columns) {
            return columns.filter(function (column) {
                return column.isPrimaryKey;
            }).map(function (column) {
                return column.name;
            });
        }
    }]);

    return TableStatementBuilder;
}();

exports.default = TableStatementBuilder;
//# sourceMappingURL=TableStatementBuilder.js.map