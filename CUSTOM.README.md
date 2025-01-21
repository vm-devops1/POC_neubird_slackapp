# main-application

- Create a `.env` file at the same path where `.env.example` is present. Copy the contents of `.env.example` to the `.env` file

- Create a `.npmrc` file at the same path where `.npmrc.example` is present. Get the details for npmrc file from your team lead.

- Initialize the application (first time, or on installing any new libraries, or to clean)

```
npm run init
```

- To start the app

```
npm run start:dev

```

Then, to validate if the app is running

```
http://localhost:3032/ping
```

Notes: The Port configured is 3031.

- To remote debug the app

Preferred Way:

```
npm run start:debug
```

Then run the `Debug VM App` debug config from the VS Code debug menu

Option 2:
Run the app in dev mode

```
npm run start:debug
```

The in VS Code, Cmd+P (open the command palette) -> type '> attach to node process'
Select the correct node process int he dropdown.

- To view API documentation

```
http://<domain-name>/swagger-ui-core/
http://<domain-name>/swagger-ui-core-json/

(Or on local host)
http://localhost:6010/swagger-ui/
http://localhost:6010/swagger-ui-json/
```

Note: Ensure that in the env file, the ENABLE_SWAGGER_UI=true and NODE_ENV=development for swagger UI to work

# Logging Levels for the app (Nest to Winston)

{
emerg: NA,
alert: NA,
crit: NA,
error: error,
warning: warn,
notice: NA,
info: log,
debug: debug,
debug: verbose,
}

##### Notes:

- ##### If the configured PORT needs to be changed, update `.env` file
- ##### output directory is `dist` configured in tsconfig.json

---

#### TODO

1. API Swagger docs access URL
1. Port Config [DONE]
1. Remote Debugging [DONE]
1. Connect to In Memory DB
1. Connect to MySql DB [DONE]
1. Connection Pool MySQL [DONE]
1. Connect to MongoDB
1. Connection Pool MongoDB
1. Connect to MSSQLDB
1. Connection Pool MSSQL
1. Entity extend base entity [DONE]
1. Set created date & updated date [DONE]
1. Transactions & Rollback [DONE]
1. Auth - JWT
1. Private (Authenticated) API Routes
1. Public API Routes
1. Authorization (Guards)
1. External API Calls
1. API input validations [DONE]
1. API doc generation
1. Multi-thread scaling
1. SSE
1. WebSockets
1. Scheduler
1. Redis
1. Startup DB Script execution
1. Object - Copy Properties [DONE]
1. DTO pattern [DONE]
1. DTO exclude certain fields while serializing [DONE]
1. Repository pattern [DONE]
1. Environment (env) Config [DONE]
1. Logging Levels [DONE]
1. Cross-env for env variables in cmd line across linux, win, mac
1. Enable CORS [DONE]
1. Disable API Explorer, API docs & Openapi.json in prod
1. Change API Base path [DONE]
1. Remove X Powered By [DONE]
1. Allow OPTIONS calls [DONE] // should be fine after enabling CORS
1. Logging in Prod with file rotation [DONE]
1. Absolute Imports [DONE]
1. Auto Register all Controllers, Services [DONE]
1. Logging - add request or thread id [DONE]
1. Run server in UTC Timezone [DONE]
1. DB Query Logging [DONE]
1. Exception Handling [DONE]
1. Functional Exception [DONE]
1. Auth Exception [DONE]
1. Make Tenant/User Context available [DONE]
1. Prod - PM2
1. Application Profiling & Monitoring
1. Error Codes
1. Standard FindAll
