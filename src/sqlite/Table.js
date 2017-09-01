import TableStatementBuilder from "./TableStatementBuilder";
import Queryable from "./../query/Queryable";
import Provider from "./Provider";

export default class Table {
    constructor(name, options = {}) {
        this.sqlite = options.sqlite;
        this.edm = options.edm;
        this.name = name;

        if (this.name == null) {
            throw new Error("The table needs to have a name.");
        }

        if (this.sqlite == null) {
            throw new Error("The table needs to have a sqlite database.");
        }

        if (this.edm == null) {
            throw new Error("The table needs to have a edm.");
        }

        this.table = this._getTable(name);

        if (this.table == null) {
            throw new Error(`Cannot find table called '${name}' with-in ${this.edm.name}.`);
        }

        this.tableStatementBuilder = new TableStatementBuilder(name, options);
        this.provider = new Provider(name, {
            edm: this.edm,
            sqlite: this.sqlite
        });
    }

    _getPrimaryKeyName() {
        var column = this.table.columns.find((column) => {
            return column.isPrimaryKey;
        });

        return column && column.name || null;
    }

    _getTable(name) {
        return this.edm.tables.find((table) => {
            return table.name === name;
        });
    }


    addEntityAsync(entity) {
        var sql = this.tableStatementBuilder.createInsertStatement(this.table, entity);

        return this.sqlite.run(sql.statement, sql.values).then((statement) => {
            entity[this._getPrimaryKeyName()] = statement.lastID;
            return entity;
        });
    }

    createAsync() {
        var tableStatement = this.tableStatementBuilder.createTableStatement(this.table, this.edm.relationships);
        var indexesStatements = this.tableStatementBuilder.createTableIndexesStatements(this.table, this.edm.relationships);

        indexesStatements.unshift(tableStatement);

        return this.sqlite.exec(indexesStatements.join(";"));
    }

    dropAsync() {
        var statement = this.tableStatementBuilder.createDropTableStatement(this.table.name);

        return this.sqlite.run(statement);
    }

    removeEntityAsync(entity) {
        var sql = this.tableStatementBuilder.createDeleteStatement(this.table, entity);

        return this.sqlite.run(sql.statement, sql.values).then(()=>{
            return entity;
        });
    }

    updateEntityAsync(entity, delta) {
        var sql = this.tableStatementBuilder.createUpdateStatement(this.table, entity, delta);

        return this.sqlite.run(sql.statement, sql.values).then(()=>{
            return Object.assign(entity, delta);
        });
    }

    asQueryable() {
        let queryable = new Queryable(this.name);
        queryable.provider = this.provider;

        return queryable;
    }

    getQueryProvider() {
        return this.provider;
    }

}