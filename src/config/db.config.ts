import {AppLogger, DB_TYPE} from '@kaiju-lib/node-common';

export function getDbConfig(env) {
  if (env.DB_TYPE) {
    if (env.DB_TYPE === DB_TYPE.MY_SQL || env.DB_TYPE === 'postgres') {
      // logging
      let queryLogging: any = {};
      if (env.LOGGING_DB_QUERIES == 'true' || env.LOGGING_DB_QUERIES) {
        queryLogging.logger = new AppLogger();
      } else {
        queryLogging.logging = false;
      }
      // CONFIGS FOR MYSQL
      return {
        type: 'postgres',
        host: env.DB_HOST,
        port: +env.DB_PORT,
        username: env.DB_USERNAME,
        password: env.DB_PASSWORD,
        database: env.DB_DATABASE,
        synchronize: true, // keep as true to create schema on start (i.e. tables if they don't exist)
        entities: ['src/entity/**/*.ts'],
        maxQueryExecutionTime: 10000, // logs queries taking more than 10 seconds to execute
        //migrations: ['src/migration/**/*.ts'],
        //subscribers: ['src/subscriber/**/*.ts'],
        //logging: true,
        ...queryLogging,
        extra: {
          connectionLimit: 10, // pool size
        },
      };
    } else if (process.env.DB_TYPE === DB_TYPE.MS_SQL) {
    } else if (process.env.DB_TYPE === DB_TYPE.MONGO_DB) {
    }
  } else {
  }
}
