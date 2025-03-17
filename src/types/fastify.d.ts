import type { OAuth2Namespace, OAuth2Token, Token } from "@fastify/oauth2";
import type { AuthorizationCode } from "simple-oauth2";
import type httpProxy from "http-proxy";

interface UserinfoResponse {
  aud: string;
  exp: number;
  iat: number;
  iss: string;
  sub: string;
  azp: string;
  preferred_username: string;
}

interface TwitchOAuth2 extends OAuth2Namespace {
  oauth2: AuthorizationCode;
  userinfo(token: Token): Promise<UserinfoResponse>;
}

declare module "fastify" {
  interface FastifyRequest {
    secure: () => boolean;
  }

  interface FastifyInstance {
    twitchOauth2: TwitchOAuth2;
    proxy: httpProxy;
    proxyRequests: Map<
      IncomingMessage,
      {
        req: FastifyRequest;
        reply: FastifyReply;
        hook?: (body: Buffer) => Buffer;
      }
    >;
  }
}

interface User {
  id: string;
  username: string;
  validated: number;
  pogly: string;
}

type JSONToken = {
  [key in keyof Token]: Token[key] extends Date ? string : Token[key];
};

declare module "@fastify/secure-session" {
  interface SessionData {
    user: User;
    token: JSONToken;
  }
}

declare module "simple-oauth2" {
  interface AuthorizationCode {
    createToken(token: JSONToken): OAuth2Token;
  }
}
