'use strict';

// requires
const
  nodeCleanup = require('node-cleanup'),
  mysql = require('mysql'),
  Exception = require('../model/Exception').model,
  logger = require('./log')(module);

/* connection string: mysql://user:pass@host:port/database?optionkey=optionvalue&optionkey=optionvalue&... */
// 'mysql://root:root@host.docker.internal:13306/DT_CC_depnemwe?debug=false&connectionLimit=150&multipleStatements=true';
const connectionStrings = process.env.MYSQL_CONNECTIONSTRINGS || 'name=mysql://user:pass@host:port/database?optionkey=optionvalue&optionkey=optionvalue&...';

const poolname2id = { };
let pools = [ ];

// init pools
(function(){
  pools = connectionStrings.split(/\s+/).filter(s => s).map((s, i) => { 
    const x = s.split('='); 
    const name = x[0], connectionString = x.slice(1).join('='); 
    logger.info(`Trying to create pool '${name}': '${connectionString}'.`);
    const poolinstance = mysql.createPool(connectionString);
    logger.info(`Initialized '${name}' with ${poolinstance.config.connectionLimit} connections.`);
    poolname2id[name] = i
    return {
      name: name,
      instance: poolinstance,
      id: i,
      available: false
    }
  });
  testpools();
})();

// test availability / init
function testpools() {
  pools.forEach(async p => {
    p.available = await testconnection(p.name);
  });
}


/*
 * Some Helper Functions
 */
async function withConnection(callback, name=null) {
  const poolname =  (!name || !(name in poolname2id)) ? Object.keys(poolname2id)[0] : name;
  logger.trace(`Using '${poolname}' ('${name}') connection.`);
  pools[poolname2id[poolname]].instance.getConnection(function (err, connection) {
    if (err)
      return callback(Exception.fromError(err, `Could not establish connection to database '${poolname}'.`), null);
    callback(null, connection);
  });
}

async function promisedQuery_sync(query, values, poolname=null) {
  return new Promise((resolve, reject) => {
      withConnection(function (err, connection) {
        if (err)
          return reject(err);
        if (query !== Object(query)) {
          query = {
            sql: query,
            values: values,
          };
        }
        connection.query(query, function (err, rows, fields) {
          if (err) {
            reject(Exception.fromError(err, `Query failed: '${query.sql}'.`, {query: query, values: values}));
            connection.release();
            return false;
          }
          resolve({ rows: rows, fields: fields });
          connection.release();
          return true;
        });
      }, poolname);
  });
}

async function query_async(query, values, cberr, cbfields, cbitem, cbend, force_item_pause, poolname=null) {
  withConnection(function (err, connection) {
    if (err)
      return cberr(err);
    if (query !== Object(query)) {
      query = {
        sql: query,
        values: values,
      };
    }
    // Pausing the connnection is useful if your processing involves I/O
    const result_fun = !force_item_pause ? row => cbitem(row, () => {}) : row => { connection.pause(); cbitem(row, () => connection.resume()); }
    connection.query(query)
      .on('error', cberr)
      .on('fields', cbfields)
      .on('result', result_fun)
      .on('end', function() {
        cbend(() => connection.release());
      });
  }, poolname);  
}

async function promisedQuery_async(query, values, cbfields, cbitem, force_item_pause, poolname=null) {
  return new Promise((resolve, reject) => {
    query_async(
      query,
      values,
      reject,
      cbfields,
      cbitem,
      resolve,
      force_item_pause,
      poolname
    );
  });
}

async function testconnection(poolname) {
  return await new Promise((resolve, reject) => {
    promisedQuery_sync('select 1;', [], poolname=poolname)
    .catch(err => {
      logger.error(`Service connection ${poolname} failed.`);
      logger.error(err);
      return resolve(false);
    })
    .then(res => {
      if(!res)
        return res;
      if(res.rows[0][1] != 1){
        logger.warn(`Connection ${poolname} might be faulty, 'SELECT 1;' is '${res}' but should be '1'. Integrity cannot be guaranteed.`); 
        return resolve(false);
      }
      return resolve(true);
    });
  });
}

function close(callback) {
  pools.forEach(e => {
    const name = e.name, pool = e.instance;
    pool.end(function (err) {
      if (err) {
        logger.warn(`Closing mysql pool '${name}' failed.`, err);
        return callback(err);
      }
      // all connections in the pool have ended
      logger.debug(`Closed database connection to '${name}'.`);
      callback(null);
    });
  });
}

// close database connection on exit
nodeCleanup(function (exitCode, signal) {
  // release resources here before node exits
  logger.debug(`About to exit with code: ${exitCode} and signal ${signal}.`);
  close((err) => { });
});

/* * * *
 *
 * Exports
 * 
 * * * */

module.exports.get_dbs = async function() {
  return Promise
    .resolve(testpools())
    .then(_ => pools.map( p => Object({name: p.name, available: p.available})));
}

module.exports.get_results_sync = async function (query, itemcallback) {
  return promisedQuery_sync('select word2 from LMI_1000_l200 where word1 = ? limit 10;', [query])
    .then(res => {
      res.rows.map(r => r.word2).forEach(_ => itemcallback(_));
    })
};

module.exports.get_results_async = async function (query, itemcallback) {
  return promisedQuery_async(
    'select word2 from LMI_1000_l200 where word1 = ? limit 10;', 
    [query],
    /* cbfields */ _ => { },
    /* cbitem   */ (r, ack) => { itemcallback(r.word2), ack(); },
    /* force_item_pause/*/ false, /* true or false check if needed */
  )
};

// use r.name, r.weight, r.rank
module.exports.get_neighbors_async = async function (query, itemcallback) {
  return promisedQuery_async(
    'select t.word2 as name, t.count as weight, (@i:=@i+1) as rank from LMI_1000_l200 as t, (select @i:=0) as _ where t.word1 = ? limit 200 offset 1', // 18446744073709551610
    [ query ],
    /* cbfields */ _ => { },
    /* cbitem   */ (r, ack) => { itemcallback(r), ack(); },
    /* force_item_pause/*/ false, /* true or false check if needed */
  )
};

module.exports.get_neighbors_sync = async function (query) {
  return promisedQuery_sync(
    'select t.word2 as name, t.count as weight, (@i:=@i+1) as rank from LMI_1000_l200 as t, (select @i:=0) as _ where t.word1 = ? limit 200 offset 1', // 18446744073709551610
    [ query ]
  ).then(res => res.rows);
};

/* * * *
 *
 * EXPORTS FOR TESTING PURPOSES
 * 
 * * * */
// module.exports.promisedQuery_sync = promisedQuery_sync
// module.exports.query_async = query_async
module.exports.promisedQuery_async = promisedQuery_async
module.exports.close = close
