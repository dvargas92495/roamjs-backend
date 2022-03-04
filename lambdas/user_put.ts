import { users } from "@clerk/clerk-sdk-node";
import {
  authenticateDeveloper,
  authenticateUser,
  headers,
  idToCamel,
  invalidTokenResponse,
} from "./common";

export const handler = authenticateDeveloper(async (event) => {
  const hs = event.headers;
  const extension = hs["x-roamjs-extension"] || hs["x-roamjs-service"];
  const token = hs["x-roamjs-token"];
  const dev = !!hs["x-roamjs-dev"];
  return authenticateUser(token, dev)
    .then((user) => {
      if (!user) {
        return invalidTokenResponse;
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
