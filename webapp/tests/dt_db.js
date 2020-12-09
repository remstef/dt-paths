'use strict';

var Exception = require('../model/Exception').model;
var logger = require('../controller/log')(module);
var db_dt = require('../controller/dt_db');


async function test(){
  await db_dt.init();
  logger.info('Ready to test');

  await db_dt.get_dt_statuses().then(
    res => logger.info(res),
    err => logger.error(err)
  );

  await db_dt.get_neighbors_sync('Jaguar#NN', 1, 10).then(
    res => logger.info(res),
    err => logger.error(err)
  );

  await db_dt.get_neighbors_async('Jaguar#NN', item => logger.info(item), 1, 10)
  .then(
    res => logger.info(res),
    err => logger.error(err)
  );
  
  db_dt.close();
}

test();
