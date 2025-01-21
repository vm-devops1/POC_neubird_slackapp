import {HttpModule, HttpService} from '@nestjs/axios';
import {Module} from '@nestjs/common';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {APP_FILTER, APP_GUARD, APP_INTERCEPTOR, HttpAdapterHost, Reflector} from '@nestjs/core';
import {TypeOrmModule} from '@nestjs/typeorm';
import {
  CommonAuthGuard,
  PublicContextInterceptor,
  AllExceptionsFilter,
  AppLogger,
  RequestInterceptor,
  CommonAuthStrategy,
} from '@kaiju-lib/node-common';
import * as registerModule from 'src/register-modules';
import {getDbConfig} from './config/db.config';
import {addTransactionalDataSource} from 'typeorm-transactional';
import {DataSource} from 'typeorm';
import {TypeOrmExModule} from 'src/util/typeorm-ex.module';
import {AuditingSubscriber} from 'typeorm-auditing';
import {EventEmitter2, EventEmitterModule} from '@nestjs/event-emitter';
import {KaijuCacheManagerModule} from '@kaiju-lib/cache-manager';
import {ServeStaticModule} from '@nestjs/serve-static';
import {join} from 'path';

let controllers = registerModule.getClassInstances('controller');
console.log('Found controllers: ', controllers);

let services = registerModule.getClassInstances('service');
console.log('Found services: ', services);
// Push Config services to read env file in this module file
services.push(ConfigService);

let entities = registerModule.getClassInstances('entity');
console.log('Found entities: ', entities);

let repos = registerModule.getClassInstances('repository');
console.log('Found repos: ', repos);

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
    }),
    EventEmitterModule.forRoot(),
    ConfigModule.forRoot(),
    // KaijuCacheManagerModule.registerAsync({
    //   imports: [],
    //   useFactory: async () => ({
    //     isGlobal: true,
    //     enable: true,
    //     adapter: {
    //       type: 'redis',
    //       host: 'redis-19207.c274.us-east-1-3.ec2.redns.redis-cloud.com',
    //       port: 19207,
    //       password: 'c1lAzPpHCT8mONnn4QZkc1mJumc7Djwb',
    //       username: 'default',
    //     },
    //     eanbleRedisSequence: true,
    //   }),
    //   inject: [],
    // }),

    TypeOrmModule.forRootAsync({
      useFactory() {
        return {...getDbConfig(process.env), entities: entities, subscribers: [AuditingSubscriber]};
      },
      async dataSourceFactory(options) {
        if (!options) {
          throw new Error('Invalid options passed');
        }

        return addTransactionalDataSource({dataSource: new DataSource(options), patch: false});
      },
    }),
    TypeOrmExModule.forCustomRepository([...entities, ...repos]),
    HttpModule,
  ],
  //controllers: [AppController],
  //providers: [AppService],
  controllers: controllers, //
  providers: [
    AppLogger,
    ...services,
    {
      provide: APP_FILTER,
      useFactory: (httpHostAdapter: HttpAdapterHost) => {
        return new AllExceptionsFilter(httpHostAdapter);
      },
      inject: [HttpAdapterHost],
    },
    {
      provide: APP_INTERCEPTOR,
      useFactory: (logger: AppLogger, httpService: HttpService, eventEmitter: EventEmitter2) => {
        return new RequestInterceptor(logger, httpService, eventEmitter);
      },
      inject: [AppLogger, HttpService, EventEmitter2],
    },
    // {
    //   provide: APP_INTERCEPTOR,
    //   useFactory: (logger: AppLogger, httpService: HttpService, reflector: Reflector) => {
    //     return new PublicContextInterceptor(logger, httpService, reflector);
    //   },
    //   inject: [AppLogger, HttpService, Reflector],
    // },
    // {
    //   provide: APP_GUARD,
    //   useFactory: (reflector: Reflector) => {
    //     return new CommonAuthGuard(reflector);
    //   },
    //   inject: [Reflector],
    // },
    // {
    //   provide: CommonAuthStrategy,
    //   useFactory: (logger: AppLogger, httpService: HttpService) => {
    //     return new CommonAuthStrategy(logger, httpService);
    //   },
    //   inject: [AppLogger, HttpService],
    // },
  ],
})
export class AppModule {}
