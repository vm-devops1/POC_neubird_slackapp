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
y

http://<domain-name>/swagger-ui-core-json/

(Or on local host)
http://localhost:6010/swagger-ui/
http://localhost:6010/swagger-ui-json/
```

Note: Ensure that in the env file, the ENABLE_SWAGGER_UI=true and NODE_ENV=development for swagger UI to work


