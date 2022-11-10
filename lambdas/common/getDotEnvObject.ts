import fs from "fs";
import dotenv from "dotenv";

const IGNORE_ENV = ["HOME"];
const getDotEnvObject = (): Record<string, string> => {
  const env: Record<string, string> = {
    ROAM_MARKETPLACE: "", // temporarily add some defaults
    ROAM_DEPOT: "",
    ...Object.fromEntries(
      Object.entries(process.env)
        .filter(([k]) => !/[()]/.test(k))
        .filter(([k]) => !IGNORE_ENV.includes(k))
    ),
    ...(fs.existsSync(".env") ? dotenv.parse(fs.readFileSync(".env")) : {}),
    ...(fs.existsSync(".env.local")
      ? dotenv.parse(fs.readFileSync(".env.local"))
      : {}),
  };
  return Object.fromEntries(
    Object.keys(env).map((k) => [`process.env.${k}`, JSON.stringify(env[k])])
  );
};

export default getDotEnvObject;
