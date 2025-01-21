import * as dotenv from 'dotenv'; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config();
import {CompositePropagator, W3CTraceContextPropagator, W3CBaggagePropagator} from '@opentelemetry/core';
import {B3InjectEncoding, B3Propagator} from '@opentelemetry/propagator-b3';
import {BatchSpanProcessor} from '@opentelemetry/sdk-trace-base';
import {JaegerPropagator} from '@opentelemetry/propagator-jaeger';
import {NodeSDK} from '@opentelemetry/sdk-node';
import {AsyncLocalStorageContextManager} from '@opentelemetry/context-async-hooks';
import * as process from 'process';
import {Resource} from '@opentelemetry/resources';
import {SemanticResourceAttributes} from '@opentelemetry/semantic-conventions';
import {OTLPTraceExporter} from '@opentelemetry/exporter-trace-otlp-http';
import {AwsInstrumentation} from '@opentelemetry/instrumentation-aws-sdk';
import {HttpInstrumentation} from '@opentelemetry/instrumentation-http';
import {ExpressInstrumentation} from '@opentelemetry/instrumentation-express';
import {FastifyInstrumentation} from '@opentelemetry/instrumentation-fastify';
import {GenericPoolInstrumentation} from '@opentelemetry/instrumentation-generic-pool';
import {GraphQLInstrumentation} from '@opentelemetry/instrumentation-graphql';
import {IORedisInstrumentation} from '@opentelemetry/instrumentation-ioredis';
import {NestInstrumentation} from '@opentelemetry/instrumentation-nestjs-core';
import {RedisInstrumentation} from '@opentelemetry/instrumentation-redis';
import {SocketIoInstrumentation} from '@opentelemetry/instrumentation-socket.io';
import {WinstonInstrumentation} from '@opentelemetry/instrumentation-winston';
import {MySQL2Instrumentation} from '@opentelemetry/instrumentation-mysql2';
import {TypeormInstrumentation} from 'opentelemetry-instrumentation-typeorm';
import {PrometheusExporter} from '@opentelemetry/exporter-prometheus';
import {HostMetrics} from '@opentelemetry/host-metrics';
import {MeterProvider} from '@opentelemetry/sdk-metrics';

const oltpExporter = new OTLPTraceExporter({
  url: process.env.APM_URL,
});
const prometheusExporter = new PrometheusExporter({
  port: parseInt(process.env.METRICS_PORT),
  prefix: process.env.APP_NAMESPACE,
  preventServerStart: process.env.ENABLE_APM == 'true' ? false : true,
});

// import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
// // For troubleshooting, set the log level to DiagLogLevel.DEBUG
// diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

export const otelSDK = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: process.env.APP_NAMESPACE,
  }),
  // metricReader: prometheusExporter,
  spanProcessor: new BatchSpanProcessor(oltpExporter),
  contextManager: new AsyncLocalStorageContextManager(),
  textMapPropagator: new CompositePropagator({
    propagators: [
      new JaegerPropagator(),
      new W3CTraceContextPropagator(),
      new W3CBaggagePropagator(),
      new B3Propagator(),
      new B3Propagator({
        injectEncoding: B3InjectEncoding.MULTI_HEADER,
      }),
    ],
  }),
  instrumentations: [
    new AwsInstrumentation(),
    new HttpInstrumentation(),
    new ExpressInstrumentation(),
    new FastifyInstrumentation(),
    new GenericPoolInstrumentation(),
    new GraphQLInstrumentation(),
    new IORedisInstrumentation(),
    new NestInstrumentation(),
    new RedisInstrumentation(),
    new SocketIoInstrumentation(),
    new WinstonInstrumentation(),
    new MySQL2Instrumentation(),
    new TypeormInstrumentation(),
  ],
});

const meterProvider = new MeterProvider();
meterProvider.addMetricReader(prometheusExporter);

const hostMetrics = new HostMetrics({meterProvider, name: 'host-metrics'});
hostMetrics.start();

// You can also use the shutdown method to gracefully shut down the SDK before process shutdown
// or on some operating system signal.
process.on('SIGTERM', () => {
  otelSDK
    .shutdown()
    .then(
      () => console.log('SDK shut down successfully'),
      err => console.log('Error shutting down SDK', err),
    )
    .finally(() => process.exit(0));
});
