import { users } from "@clerk/clerk-sdk-node";
import {
  authenticate,
  authenticateUserShim,
  headers,
} from "./common";

const normalize = (hdrs: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(hdrs).map(([k, v]) => [k.toLowerCase(), v])
  );

export const handler = authenticate(async (event) => {
  const hs = normalize(event.headers);
  const service = hs["x-roamjs-service"];
  const token = hs["x-roamjs-token"];
  const dev = !!hs["x-roamjs-dev"];
  return authenticateUserShim(token, service, dev)
    .then((user) => {
      if (!user) {
        return {
          statusCode: 401,
          body: "Invalid token",
          headers,
        };
      }
      if (!user.publicMetadata[service]) {
        return {
          statusCode: 403,
          body: "User not allowed to access this method",
          headers,
        };
      }
      const serviceData = user.publicMetadata[service] as Record<
        string,
        unknown
      >;
      return users
        .updateUser(user.id, {
          publicMetadata: {
            ...user.publicMetadata,
            [service]: {
              ...serviceData,
              ...JSON.parse(event.body || "{}"),
              token: serviceData.token,
            },
          },
        })
        .then(() => ({
          statusCode: 200,
          body: JSON.stringify({ succes: true }),
          headers,
        }));
    })
    .catch((e) => ({
      statusCode: e.status || 500,
      body: e.response?.data || e.message,
      headers,
    }));
});
