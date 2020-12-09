'use strict';

// requires
const
  nodeCleanup = require('node-cleanup'),
  DB = require('../model/DB').model,
  Exception = require('../model/Exception').model,
  logger = require('./log')(module);

/* connection string: mysql://user:pass@host:port/database?optionkey=optionvalue&optionkey=optionvalue&... */
// 'mysql://root:root@host.docker.internal:13306/DT_CC_depnemwe?debug=false&connectionLimit=150&multipleStatements=true';
const definitionstrings = process.env.MYSQL_CONNECTIONSTRINGS || 'name=mysql://user:pass@host:port/database?optionkey=optionvalue&optionkey=optionvalue&...';

const dbname2id = { };
const dblist = [ ];
let initialized = false;

// init database connections
module.exports.init = async function() {
  await Promise.all(definitionstrings.split(/\s+/).filter(s => s).map(connectiondefinitionstring =>
    DB.fromDefinition(connectiondefinitionstring).init_promise()
  ))
  .then((dbs) => dbs.forEach((db, i) => {
    logger.info(db.status());
    dblist.push(db);
    dbname2id[db.name] = i;
    initialized = true;
  }));
};

module.exports.close = async function() {
  await Promise.all(dblist.map(db => {
    db.close_promise()
      .then(
        res => logger.info(`Closed DB ${db.name}.`),
        err => Exception.fromError(err, `Closing DB ${db.name} failed.`).log(logger, logger.warn)
      )
  }));
}

module.exports.get_dt_statuses = function() {
  return Promise.resolve(dblist.map(db => Object({name: db.name, available: db.isavailable})));
}

module.exports.get_dt = function(dt) {
  return Promise.resolve(use_dt(dt));
}

function use_dt(dt = null) {
  if(!dt)
    return dblist[0];
  if(dt instanceof DB)
    return dt;
  if(!dt in dbname2id)
    return dblist[0];
  return dblist[dbname2id[dt]];
}

// use r.name, r.weight, r.rank
module.exports.get_neighbors_async = async function (query, itemcallback, offset=1, limit=200, dt=null) {
  const db = use_dt(dt);
  return db.query_async_promise(
    'select t.word2 as name, t.count as weight, (@i:=@i+1)+? as rank from LMI_1000_l200 as t, (select @i:=0) as _ where t.word1 = ? limit ? offset ?', // 18446744073709551610
    [  offset, query, limit, offset ],
    /* cbfields */ _ => { },
    /* cbitem   */ (row, ack) => { itemcallback(row), ack(); },
    /* force_item_pause/*/ false, /* true or false check if needed */
  )
};

module.exports.get_neighbors_sync = async function (query, offset=1, limit=200, dt=null) {
  const db = use_dt(dt);
  return db.query_promise(
    'select t.word2 as name, t.count as weight, (@i:=@i+1)+? as rank from LMI_1000_l200 as t, (select @i:=0) as _ where t.word1 = ? limit ? offset ?', // 18446744073709551610
    [ offset, query, limit, offset ]
  ).then(res => res.rows);
};

// close database connections on exit
nodeCleanup(async function (exitCode, signal) {
  // release resources here before node exits
  logger.debug(`About to exit with code: ${exitCode} and signal ${signal}.`);
  await module.exports.close();
});
