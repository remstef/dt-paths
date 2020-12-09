'use strict'; 

var Exception = require('../model/Exception').model;
var DB = require('../model/DB').model;
var logger = require('../controller/log')(module);

const connectiondefinitionstring = 'depcc=mysql://root:root@host.docker.internal:13306/DT_CC_depnemwe?debug=false&connectionLimit=150&multipleStatements=true';

async function test(){
  
  const db = await DB.fromDefinition(connectiondefinitionstring).init_promise();
  
  logger.info(db.status());
  
  await db.query_promise(
    'select word2 from LMI_1000_l200 where word1 = ? limit 10;', 
    ['jaguar#NN']
  ).then(
    res => logger.info(res.rows),
    err => logger.error(err)
  )

  await db.query_async_promise(
    'select word2 from LMI_1000_l200 where word1 = ? limit 10;', 
    ['jaguar#NN'], 
    fields => { }/*logger.trace(fields)*/, 
    (item, ack) => { logger.info(item); ack(); }, 
    true
  ).then(
    res => logger.info(res),
    err => logger.error(err)
  )

  await db.close_promise();
}

test();
