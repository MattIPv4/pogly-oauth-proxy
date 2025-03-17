declare namespace NodeJS {
  type ProcessEnv = Record<string, never> & {
    readonly TWITCH_CLIENT_ID?: string;
    readonly TWITCH_CLIENT_SECRET?: string;
    readonly SESSION_SECRET?: string;
    readonly POGLY_HOST?: string;
    readonly POGLY_MODULES?: string;
    readonly DATA_PATH?: string;
    readonly PORT?: string;
    readonly HOST?: string;
    readonly FORCE_SECURE?: string;
  };
}
