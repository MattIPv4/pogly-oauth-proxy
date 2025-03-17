import { readFile, writeFile } from "node:fs/promises";

const isObjectAny = (value: any): value is Record<string, any> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const isObjectProps = <T>(
  value: any,
  properties: [string, (value: any) => boolean][],
): value is T => {
  return (
    isObjectAny(value) &&
    Object.keys(value).length === properties.length &&
    properties.every(
      ([key, validator]) => key in value && validator(value[key]),
    )
  );
};

interface User {
  username: string;
  token: string;
}

const isUser = (value: any): value is User => {
  return isObjectProps<User>(value, [
    ["username", (value: any) => typeof value === "string"],
    ["token", (value: any) => typeof value === "string"],
  ]);
};

interface Database {
  users: Record<string, User>;
}

const isDatabase = (value: any): value is Database => {
  return isObjectProps<Database>(value, [
    [
      "users",
      (value: any) => isObjectAny(value) && Object.values(value).every(isUser),
    ],
  ]);
};

const path = process.env.DATA_PATH
  ? new URL("data.json", process.env.DATA_PATH)
  : new URL("../data.json", import.meta.url);

const load = async (): Promise<Database> => {
  const data = await readFile(path, "utf8");
  const parsed = JSON.parse(data);
  if (isDatabase(parsed)) return parsed;
  else throw new Error("Database not in expected format");
};

const store = async () => {
  await writeFile(path, JSON.stringify(db, null, 2));
};

const db = await load();

export const getUser = async (id: string) => {
  if (id in db.users) return Object.assign({} as User, db.users[id]);
  return null;
};

export const setUser = async (
  id: string,
  { username, token }: { username: string; token: string },
) => {
  db.users[id] = { username, token };
  await store();
};
