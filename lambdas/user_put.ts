import { setClerkApiKey, users } from "@clerk/clerk-sdk-node";
import { authenticate, headers } from "./common";

const normalize = (hdrs: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(hdrs).map(([k, v]) => [k.toLowerCase(), v])
  );

export const handler = authenticate(async (event) => {
  const hs = normalize(event.headers);
  const service = hs["x-roamjs-service"];
  const token = hs["x-roamjs-token"];
  const dev = !!hs["x-roamjs-dev"];
  if (dev) {
    setClerkApiKey(process.env.CLERK_DEV_API_KEY);
  }
  const userId = Buffer.from(token, "base64").toString().split(":")[0];
  const { publicMetadata } = await users
    .getUser(`user_${userId}`)
    .catch(() => ({ publicMetadata: undefined }));
  if (!publicMetadata) {
    return {
      statusCode: 401,
      body: "Could not find user from the given token",
      headers,
    };
  }
  const { [service]: serviceData } = publicMetadata as Record<
    string,
    { token: string }
  >;
  const { token: storedToken } = serviceData;
  if (!storedToken || token !== storedToken) {
    return {
      statusCode: 401,
      body: "User is unauthorized to access your service",
      headers,
    };
  }
  await users.updateUser(`user_${userId}`, {
    publicMetadata: {
      ...publicMetadata,
      [service]: {
        ...serviceData,
        ...JSON.parse(event.body || "{}"),
        token: storedToken,
      },
    },
  });
  return {
    statusCode: 200,
    body: JSON.stringify({ succes: true }),
    headers,
  };
}, "developer");
