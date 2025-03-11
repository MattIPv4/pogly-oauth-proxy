import { OAuth2Namespace } from "@fastify/oauth2";

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
  userinfo(token: Token): Promise<UserinfoResponse>;
}

declare module "fastify" {
  interface FastifyInstance {
    twitchOauth2: TwitchOAuth2;
  }
}
