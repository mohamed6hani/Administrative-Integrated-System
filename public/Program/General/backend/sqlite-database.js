const { DatabaseSync } = require('node:sqlite');

// Small synchronous adapter for Storage's existing statement/transaction API.
class SqliteDatabase {
  constructor(filename) { this.db = new DatabaseSync(filename); }
  prepare(sql) { return this.db.prepare(sql); }
  exec(sql) { this.db.exec(sql); }
  pragma(statement) { return this.db.prepare(`PRAGMA ${statement}`).all(); }
  transaction(action) {
    return (...args) => {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        const result = action(...args);
        this.db.exec('COMMIT');
        return result;
      } catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
      }
    };
  }
  close() { this.db.close(); }
}

module.exports = SqliteDatabase;
