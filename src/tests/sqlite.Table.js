import assert from "assert";
import Table from "./../sqlite/Table";
import edm from "./../mock/edm";
import sqlite from "sqlite";

const databaseFile = ":memory:";

exports["Table: addEntityAsync"] = () => {
    var table = new Table("Source", {
        edm: edm,
        sqliteDatabase: {
            run: (statement, values) => {
                assert.equal(statement, 'INSERT INTO "Source" ("string") VALUES (?)');
                assert.equal(values[0], "Hello World");

                return Promise.resolve({ stmt: { lastID: 1 } });
            }
        }
    });

    table.addEntityAsync({ string: "Hello World" });
};

exports["Table.createAsync: Create a Source Table."] = () => {
    var table = new Table("Source", {
        edm: edm,
        sqliteDatabase: {
            exec: (statement, values) => {
                assert.equal(statement, 'CREATE TABLE IF NOT EXISTS "Source" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "string" TEXT, "number" NUMERIC, "date" NUMERIC, "boolean" NUMERIC, "float" REAL);CREATE INDEX IF NOT EXISTS "id" ON "Source" ("id")');
                return Promise.resolve(null);
            }
        }
    });

    table.createAsync();
};

exports["Table.createAsync: Create a Target Table."] = () => {
    var table = new Table("Foreign", {
        edm: edm,
        sqliteDatabase: {
            exec: (statement, values) => {
                assert.equal(
                    statement,
                    'CREATE TABLE IF NOT EXISTS "Foreign" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "foreignKey" INTEGER, FOREIGN KEY ("foreignKey") REFERENCES "Source" ("id"));CREATE INDEX IF NOT EXISTS "foreignKey" ON "Foreign" ("foreignKey");CREATE INDEX IF NOT EXISTS "id" ON "Foreign" ("id")'
                );
                return Promise.resolve(null);
            }
        }
    });

    table.createAsync();
};

exports["Table.asQueryable: Query off nested one to one."] = () => {

    return sqlite.open(":memory:").then((db) => {

        var table = new Table("Source", {
            edm: edm,
            sqliteDatabase: db
        });

        return table.createAsync().then(() => {
            return table.asQueryable().where((expBuilder) => {
                return expBuilder.property("foreigner").property("string").isEqualTo("Hello World");
            }).toArrayAsync();
        });

    });



};