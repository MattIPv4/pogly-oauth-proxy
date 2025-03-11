import fastify from "fastify";
import fastifyOauth2 from "@fastify/oauth2";
import fastifySecureSession from "@fastify/secure-session";
import { randomUUID } from "node:crypto";

// TODO: https://github.com/fastify/fastify-http-proxy

if (!process.env.TWITCH_CLIENT_ID)
  throw new Error("TWITCH_CLIENT_ID is required");
if (!process.env.TWITCH_CLIENT_SECRET)
  throw new Error("TWITCH_CLIENT_SECRET is required");
if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET is required");

const server = fastify({
  genReqId: () => randomUUID(),
});

server.addHook("preHandler", async (req) => {
  req.headers["x-request-id"] = req.id;
});

const tokenRequestParams = {
  client_id: process.env.TWITCH_CLIENT_ID,
  client_secret: process.env.TWITCH_CLIENT_SECRET,
};

server.register(fastifyOauth2, {
  name: "twitchOauth2",
  scope: ["openid"],
  credentials: {
    client: {
      id: process.env.TWITCH_CLIENT_ID,
      secret: process.env.TWITCH_CLIENT_SECRET,
    },
  },
  tokenRequestParams,
  discovery: {
    issuer: "https://id.twitch.tv/oauth2",
  },
  callbackUri: (req) => `${req.protocol}://${req.host}/login/twitch/callback`,
});

server.register(fastifySecureSession, {
  key: Buffer.from(process.env.SESSION_SECRET, "hex"),
  cookie: {
    path: "/",
    httpOnly: true,
  },
});

server.addHook("preHandler", async (req) => {
  const user = req.session.get("user");
  if (!user) return;

  const tokenData = req.session.get("token");
  const token = tokenData && server.twitchOauth2.oauth2.createToken(tokenData);
  if (!token) return;

  // If the token has expired, attempt to refresh it
  if (token.expired()) {
    try {
      const newToken = await token.refresh(tokenRequestParams);
      req.session.set("token", {
        ...newToken.token,
        expires_at: newToken.token.expires_at.toISOString(),
      });
      req.session.set("user", { ...user, validated: Date.now() });
      console.log(
        `${req.id} refreshed token for ${user.id} (${user.username})`,
      );
    } catch (error) {
      console.error(
        `${req.id} failed to refresh token for ${user.id} (${user.username})`,
        error,
      );
      req.session.regenerate();
    }

    return;
  }

  // If we haven't revalidated for 5 minutes, check it
  if (user.validated + 5 * 60 * 1000 <= Date.now()) {
    try {
      const res = await fetch("https://id.twitch.tv/oauth2/validate", {
        headers: {
          Authorization: `OAuth ${token.token.access_token}`,
        },
      });
      if (!res.ok) throw new Error(await res.text());
      req.session.set("user", { ...user, validated: Date.now() });
      console.log(
        `${req.id} validated token for ${user.id} (${user.username})`,
      );
    } catch (error) {
      console.error(
        `${req.id} failed to validate token for ${user.id} (${user.username})`,
        error,
      );
      req.session.regenerate();
    }

    return;
  }
});

server.get("/login/twitch/callback", async (req, reply) => {
  req.session.regenerate();

  try {
    const token =
      await server.twitchOauth2.getAccessTokenFromAuthorizationCodeFlow(req);
    const user = await server.twitchOauth2.userinfo(token.token);

    // TODO: Ensure user is in database

    req.session.set("user", {
      id: user.sub,
      username: user.preferred_username,
      validated: Date.now(),
    });
    req.session.set("token", {
      ...token.token,
      expires_at: token.token.expires_at.toISOString(),
    });

    // TODO: If new user, get token from Pogly and store in database

    console.log(
      `${req.id} authenticated as ${user.sub} (${user.preferred_username})`,
    );
    return reply.redirect("/");
  } catch (error) {
    console.error(`${req.id} failed to authenticate`, error);
    return reply.send(new Error("Failed to authenticate"));
  }
});

server.get("/login/twitch", async (req, reply) => {
  req.session.regenerate();

  const uri = await server.twitchOauth2.generateAuthorizationUri(req, reply);
  return reply.redirect(uri);
});

// TODO: Proxy requests to pogly
// TODO: Inject Pogly token + modules + nickname into response
// TODO: Allow overlay route to bypass auth

server.get("/", async (req, reply) => {
  const user = req.session.get("user");
  if (!user) return reply.send("Not authenticated");

  return reply.send(`Authenticated as ${user.id} (${user.username})`);
});

server.listen({ port: 3000 }).then((res) => {
  console.log(`Server running on ${res.replace("[::1]", "localhost")}`);
});
