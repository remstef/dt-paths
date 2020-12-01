
var Exception = require('../model/Exception').model;
var logger = require('../controller/log')(module);
var db = require('../controller/db');

// db.promisedQuery('select word2 from LMI_1000_l200 where word1 = ? limit 10;', ['bank#NN'])
//   .catch(_ => Exception.fromError(_, 'Could not retrieve result.').log(logger, logger.error))
//   .then(console.log)
//   .then(_ => db.close(function(){}))

Promise.resolve(false)
  .then(_ => console.log('test'))
  .then(_ => db.promisedQuery_async('select word2 from LMI_1000_l200 where word1 = ? limit 10;', ['jaguar#NN'], _ => logger.info(_), (_, cb) => {logger.info(_); cb();}, false))
  .then(ack => ack())
  .catch(_ => logger.error(_))
  .then(_ => db.close(() => {}))

