import {
  type FastifyRequest,
  type FastifyReply,
  type FastifyInstance,
} from "fastify";
import fastifyRawBody from "fastify-raw-body";

interface Options {
  host: string;
  modules?: string[];
}

const pogly = async (
  req: FastifyRequest,
  reply: FastifyReply,
  opts: Options,
  hook?: (body: ArrayBuffer) => ArrayBufferLike,
) => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) continue;
    for (const v of Array.isArray(value) ? value : [value])
      headers.append(key, v);
  }
  headers.set("Origin", opts.host);

  const resp = await fetch(`${opts.host}${req.url}`, {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : req.rawBody,
  });
  reply.status(resp.status);
  for (const [key, value] of resp.headers.entries()) reply.header(key, value);

  const body = await resp.arrayBuffer();
  reply.send(Buffer.from(hook ? hook(body) : body));
};

const proxy = async (server: FastifyInstance, opts: Options) => {
  await server.register(fastifyRawBody, {
    global: false,
    runFirst: true,
  });

  server.all("/*", {
    config: {
      rawBody: true,
    },
    handler: async (req, reply) => {
      if (req.method === "OPTIONS") {
        console.log(`${req.id} ${req.method} ${req.url} preflight request`);
        return pogly(req, reply, opts);
      }

      // TODO: Allow overlay route to bypass auth

      const user = req.session.get("user");
      if (!user) {
        console.log(`${req.id} unauthorized request`);
        return reply.status(401).send(new Error("Unauthorized"));
      }

      console.log(
        `${req.id} ${req.method} ${req.url} authenticated as ${user.id} (${user.username})`,
      );

      return pogly(req, reply, opts, (body) => {
        if (req.method === "GET" && /^\/($|\?)/.test(req.url)) {
          const html = new TextDecoder().decode(body);
          const domain = opts.host.replace(/^http/, "ws") ?? ""; // TODO: Need to proxy ws
          const modules = opts.modules ?? ["pogly"];
          return new TextEncoder().encode(
            html.replace(
              /<body>/,
              [
                "<body>",
                "<script>",
                `window.localStorage.setItem("stdbToken", ${JSON.stringify(user.pogly)});`,
                `window.localStorage.setItem("stdbConnectDomain", ${JSON.stringify(domain)});`,
                `window.localStorage.setItem("stdbConnectModule", ${JSON.stringify(modules[0])});`,
                `window.localStorage.setItem("nickname", ${JSON.stringify(user.username)});`,
                `window.localStorage.setItem("poglyQuickSwap", ${JSON.stringify(JSON.stringify(modules.map((module) => ({ domain, module }))))});`,
                "</script>",
              ].join(""),
            ),
          ).buffer;
        }
        return body;
      });
    },
  });
};

export default proxy;
