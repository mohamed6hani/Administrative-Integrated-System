const fs = require('fs');
const initSqlJs = require('sql.js');

let SQL = null;

class Database {
    constructor(filename) {
        this.filename = filename;
        this.db = null;
    }

    static async initialize() {
        if (!SQL) {
            SQL = await initSqlJs();
        }
    }

    open() {
        if (!SQL) throw new Error('Call Database.initialize() first');
        if (fs.existsSync(this.filename)) {
            const data = fs.readFileSync(this.filename);
            this.db = new SQL.Database(data);
        } else {
            this.db = new SQL.Database();
        }
    }

    save() {
        if (!this.db) return;
        const data = this.db.export();
        fs.writeFileSync(this.filename, Buffer.from(data));
    }

    exec(sql) {
        this.db.run(sql);
        this.save();
    }

    pragma(sql) {
        this.db.run('PRAGMA ' + sql);
    }

    prepare(sql) {
        const self = this;
        return {
            get(...params) {
                const stmt = self.db.prepare(sql);
                if (params.length) stmt.bind(params);
                let row;
                if (stmt.step()) {
                    const cols = stmt.getColumnNames();
                    const vals = stmt.get();
                    row = {};
                    for (let i = 0; i < cols.length; i++) row[cols[i]] = vals[i];
                }
                stmt.free();
                return row;
            },
            all(...params) {
                const stmt = self.db.prepare(sql);
                if (params.length) stmt.bind(params);
                const rows = [];
                while (stmt.step()) {
                    const cols = stmt.getColumnNames();
                    const vals = stmt.get();
                    const row = {};
                    for (let i = 0; i < cols.length; i++) row[cols[i]] = vals[i];
                    rows.push(row);
                }
                stmt.free();
                return rows;
            },
            run(...params) {
                const stmt = self.db.prepare(sql);
                if (params.length) stmt.bind(params);
                stmt.step();
                // Mimic better-sqlite3 result object
                const lastID = self.db.exec("SELECT last_insert_rowid() AS id")[0]?.values?.[0]?.[0] || 0;
                const changes = self.db.getRowsModified();
                stmt.free();
                self.save();
                return { lastInsertRowid: lastID, changes };
            }
        };
    }

    close() {
        if (this.db) {
            this.save();
            this.db.close();
            this.db = null;
        }
    }
}

module.exports = Database;


