This is a proxy that adds Twitch authentication to [Pogly](https://github.com/PoglyApp/pogly-standalone), a real-time collaborative stream overlay.

## Developing locally

Make sure you're running Node.js matching the version specified in [`.nvmrc`](.nvmrc). Then, install the required dependencies for the project with `npm ci`.

To run the proxy locally, copy [`.env.example`](.env.example) to `.env` and use the [environment variable guide](#Environment-Variables) above to set the variables. Then, start the proxy with `npm start`.

If you don't have a Pogly server running already, you can use the provided [`docker-compose.yaml`](docker-compose.yaml) file in this repository to start one with `docker compose up -d`. If you're using this, make sure the `MODULES` match your `POGLY_MODULES` in the `.env` file.

## Environment Variables

The configuration is all done via environment variables. These are the variables you will NEED to set before running the proxy.

### POGLY_MODULES

Pogly modules are like different instances of the overlay that can be switched between. Each module can have its own content & channel. There are no extra permissions to allow or restrict access to each module -- if a Twitch user has access, they have access to all modules. These need to be the same as the modules in the Pogly server.

### TWITCH_CLIENT_ID & TWITCH_CLIENT_SECRET

Create a [Twitch application](https://dev.twitch.tv/console/apps/create) and add `<host>/login/twitch/callback` to the OAuth Redirect URLs, with `<host>` replaced by the base URL that the proxy will be accessible at (`http://localhost:3000` for local development).

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

To allow users to login, you need to add their Twitch user id to the `users` object in the `data.json` file. The easiest way to do this is [looking it up](https://www.streamweasels.com/tools/convert-twitch-username-%20to-user-id/) via their username. The user id should be the key to an object containing a `username` and `token` property -- you can populate the `username` property as a reference for who the ID is, and leave the `token` an empty string.

```json
{
  "users": {
    "1234567890": {
      "username": "TwitchUser",
      "token": ""
    }
  }
}
```

## Setting up modules

When you access Pogly for the first time, you'll be prompted to configure a module -- this will be the first module you defined in `POGLY_MODULES`. You must NOT enable authentication or strict mode for any modules behind the proxy -- the proxy handles access control.

Once the first module is configured, you'll see an option in the UI to swap to any other modules you provided in `POGLY_MODULES` (it is recommended you swap to these and configure them during first-time setup so your Twitch account is stored as the "owner" of the modules).

You can also add new modules at any time -- make sure they're added to both the Pogly `MODULES` environment variable and the proxy's `POGLY_MODULES` environment variable.

You'll also need to create a data.json file in the same directory as the docker-compose.yaml file with your twitch user id. You can follow the instructions [here](#datajson) to do this.

## Deploying

The proxy does not have to run on the same machine as the Pogly server but it's important that access to the Pogly server is not exposed to the internet and only accessible via the proxy otherwise anyone will be able to access & edit the overlay.

The easiest way to achieve this is by running them together in Docker, such as with Docker Compose:

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
      POGLY_MODULES: "pogly module2 module3"
      DATA_PATH: file:///proxy/
      SESSION_SECRET: "32_bytes_of_random_hex_data"
      TWITCH_CLIENT_ID: "your_twitch_client_id"
      TWITCH_CLIENT_SECRET: "your_twitch_client_secret"

    volumes:
      - ./data.json:/proxy/data.json

volumes:
  pogly-keys:
  pogly-data:
  pogly-config:
```
