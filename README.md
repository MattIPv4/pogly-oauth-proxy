This is a proxy that adds Twitch authentication to [Pogly](https://github.com/PoglyApp/pogly-standalone), a real-time collaborative stream overlay.

If you want to develop locally, you can follow the instructions [here](#Developing-locally).

## Deploying

The proxy does not have to run on the same machine as the Pogly server but it's important that access to the Pogly server is not exposed to the internet and only accessible via the proxy otherwise anyone will be able to access & edit the overlay.

The easiest way to achieve this is by running them together in docker. Here is an example docker compose file:

```yaml
services:
  pogly:
    image: ghcr.io/poglyapp/pogly:main
    restart: always
    volumes:
      - pogly-keys:/etc/spacetimedb
      - pogly-data:/stdb
      - pogly-config:/root/.spacetime
    environment:
      MODULES: "pogly module2 module3"

  proxy:
    image: ghcr.io/mattipv4/pogly-oauth-proxy:latest
    depends_on:
      - pogly
    restart: always
    ports:
      - 3000:4000/tcp
    environment:
      PORT: 4000
      HOST: 0.0.0.0
      POGLY_HOST: http://pogly:80
      DATA_PATH: file:///proxy/

      # npx -y @fastify/secure-session | node -e "console.log(fs.readFileSync(0).toString('hex'))"
      SESSION_SECRET: "32_bytes_of_random_characters"

      POGLY_MODULES: "pogly module2 module3"
      TWITCH_CLIENT_ID: "your_twitch_client_id"
      TWITCH_CLIENT_SECRET: "your_twitch_client_secret"

    volumes:
      - ./data.json:/proxy/data.json

volumes:
  pogly-keys:
  pogly-data:
  pogly-config:
```

## Environment Variables

The configuration is all done via environment variables. These are the variables you will NEED to set before running the proxy.

### POGLY_MODULES

Pogly modules are like different instances of the overlay that can be switched between. Each module can have it's own content & channel. There is no extra permissions to allow or restrict access to each module. If a twitch user has access, they have access to all modules. These need to be the same as the modules in the Pogly server.

### TWITCH_CLIENT_ID & TWITCH_CLIENT_SECRET

Go to the Twitch Developer Dashboard.
Create a new application and add `http://localhost:3000/login/twitch/redirect` to the OAuth Redirect URLs.

Copy the generated Client ID and Client Secret and add them to the environment variables.

### SESSION_SECRET

This is used to encrypt the session cookie. You can generate a suitably secure random string with the following command:

```bash
npx -y @fastify/secure-session | node -e "console.log(fs.readFileSync(0).toString('hex'))"
```

## data.json

You also need to create a `data.json` file in the same directory with the following content:

```json
{
  "users": {}
}
```

To allow users to login, you need to add their twitch user id to the `data.json` file. The easiest way to do this is looking it up [here](https://www.streamweasels.com/tools/convert-twitch-username-%20to-user-id/) via their username. You'll need to add the username and token properties too but just leave them blank.

```json
{
  "users": {
    "1234567890": {
      "username": "",
      "token": ""
    }
  }
}
```

## Setting up modules

When you access Pogly for the first time, you'll be prompted to create a module. It's important that you DON'T enable authentication or strict mode. You can create & swap between multiple modules without having to login again. You can also create a new module at any time, as long as the module name is specified in the `POGLY_MODULES` & `MODULES` environment variables.

## Developing locally

To run it locally, copy .env.example to .env and use the [environment variable guide](#Environment-Variables) above to set the variables.

If you don't have a Pogly server running already, you can use the docker-compose.yaml file in this repository to start one.

```bash
docker compose up -d
```

You'll also need to create a data.json file in the same directory as the docker-compose.yaml file with your twitch user id. You can follow the instructions [here](#datajson) to do this.
