import { users } from "@clerk/clerk-sdk-node";
import {
  authenticate,
  authenticateUserShim,
  headers,
  idToCamel,
} from "./common";

export const handler = authenticate(async (event) => {
  const hs = event.headers;
  const extension = hs["x-roamjs-extension"] || hs["x-roamjs-service"];
  const token = hs["x-roamjs-token"];
  const dev = !!hs["x-roamjs-dev"];
  return authenticateUserShim(token, extension, dev)
    .then((user) => {
      if (!user) {
        return {
          statusCode: 401,
          body: "Invalid token",
          headers,
        };
      }
      const extensionField = idToCamel(extension);
      if (!user.publicMetadata[extensionField]) {
        return {
          statusCode: 403,
          body: "User not allowed to access this method",
          headers,
        };
      }
      const serviceData = user.publicMetadata[extensionField] as Record<
        string,
        unknown
      >;
      return users
        .updateUser(user.id, {
          publicMetadata: {
            ...user.publicMetadata,
            [extensionField]: {
              ...serviceData,
              ...JSON.parse(event.body || "{}"),
              token: serviceData.token,
            },
          },
        })
        .then(() => ({
          statusCode: 200,
          body: JSON.stringify({ success: true }),
          headers,
        }));
    })
    .catch((e) => ({
      statusCode: e.status || 500,
      body: e.response?.data || e.message,
      headers,
    }));
});
