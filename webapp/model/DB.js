'use strict';

// requires
const
  mysql = require('mysql2'),
  Exception = require('./Exception').model,
  logger = require('../controller/log')(module);

/**
 * object variables
 * */ 
DB.prototype.name = null;
DB.prototype.connectionstring = null;
DB.prototype.pool = null;
DB.prototype.promisepool = null;
DB.prototype.isavailable = false; 

/**
 * @constructor
 */
function DB(name, connectionstring) {
  this.name = name;
  this.connectionstring = connectionstring;
}

DB.fromDefinition = function(defintionstring) {
  const splits = defintionstring.split('='); 
  const name = splits[0];
  const connectionstring = splits.slice(1).join('=');
  return new DB(name, connectionstring);
}

DB.prototype.init_promise = async function() {
  return new Promise(async (resolve, reject) => {
    logger.info(`Initializing pool '${this.name}': '${this.connectionstring}'.`);
    this.pool = mysql.createPool(this.connectionstring);
    this.promisepool = this.pool.promise();
    logger.info(`Initialized '${this.name}' with ${this.pool.config.connectionLimit} connections.`);
    await this.test();
    resolve(this);
  })
}

DB.prototype.close_promise = async function() {
  return this.promisepool.end();
}

DB.prototype.query_promise = async function(query, values){
  return this.promisepool.query(query, values).then(
    rows_fields => Object({rows: rows_fields[0], fields: rows_fields[1]})
  );
}

DB.prototype.query_async_promise = async function(query, values, cbfields, cbitem, force_item_pause) {
  return new Promise((resolve, reject) => {
    this.pool.getConnection(function(err, connection){
      if(err) reject(err);
      else resolve(connection);
    })
  }).then(conn => new Promise((resolve, reject) => {
    const result_fun = !force_item_pause ? 
      row => cbitem(row, () => {}) : 
      row => { conn.pause(); cbitem(row, () => conn.resume()); };

    // Pausing the connnection is useful if processing involves I/O
    conn.query({ sql: query, values: values})
      .on('error', reject)
      .on('fields', cbfields)
      .on('result', result_fun)
      .on('end', function() {
        conn.release();
        resolve();
      });
  }));
}

DB.prototype.test = async function() {
  this.isavailable = await this.query_promise('select 1+1 as solution').then(
    res => (res.rows[0].solution == 2),
    err => {
      Exception.fromError(err).log(logger, logger.warn);
      return false;
    }
  );
  return this.isavailable;
}

DB.prototype.status = function() {
  return `
  Name: ${this.name}
  Connectionstring: ${this.connectionstring}
  Available: ${this.isavailable}`;
}

module.exports.model = DB;
