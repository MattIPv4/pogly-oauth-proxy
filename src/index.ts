import fastify from "fastify";
import fastifyOauth2 from "@fastify/oauth2";
import { randomUUID } from "node:crypto";

if (!process.env.TWITCH_CLIENT_ID)
  throw new Error("TWITCH_CLIENT_ID is required");
if (!process.env.TWITCH_CLIENT_SECRET)
  throw new Error("TWITCH_CLIENT_SECRET is required");

const server = fastify({
  genReqId: () => randomUUID(),
});

server.addHook("preHandler", (req, reply, done) => {
  req.headers["x-request-id"] = req.id;
  done();
});

server.register(fastifyOauth2, {
  name: "twitchOauth2",
  scope: ["openid"],
  credentials: {
    client: {
      id: process.env.TWITCH_CLIENT_ID,
      secret: process.env.TWITCH_CLIENT_SECRET,
    },
  },
  tokenRequestParams: {
    client_id: process.env.TWITCH_CLIENT_ID,
    client_secret: process.env.TWITCH_CLIENT_SECRET,
  },
  discovery: {
    issuer: "https://id.twitch.tv/oauth2",
  },
  callbackUri: (req) => `${req.protocol}://${req.host}/login/twitch/callback`,
});

server.get("/login/twitch/callback", async (req, reply) => {
  try {
    const { token } =
      await server.twitchOauth2.getAccessTokenFromAuthorizationCodeFlow(req);
    const user = await server.twitchOauth2.userinfo(token);
    console.log(
      `${req.id} authenticated as ${user.sub} (${user.preferred_username})`,
    );
    return reply.send("Authenticated");
  } catch (error) {
    console.error(`${req.id} failed to authenticate`, error);
    return reply.send(new Error("Failed to authenticate"));
  }
});

server.get("/login/twitch", async (req, reply) => {
  const uri = await server.twitchOauth2.generateAuthorizationUri(req, reply);
  return reply.redirect(uri);
});

server.listen({ port: 3000 }).then((res) => {
  console.log(`Server running on ${res.replace("[::1]", "localhost")}`);
});
