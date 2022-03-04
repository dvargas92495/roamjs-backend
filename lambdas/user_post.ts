import { users } from "@clerk/clerk-sdk-node";
import {
  authenticateDeveloper,
  authenticateUser,
  getStripePriceId,
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
    .then(async (user) => {
      if (!user) {
        return invalidTokenResponse;
      }
      const extensionField = idToCamel(extension);
      if (user.publicMetadata[extensionField]) {
        return {
          statusCode: 409,
          body: "User has already inited this extension",
          headers,
        };
      }
      const priceId = await getStripePriceId(extension, dev);
      if (priceId) {
        return {
          statusCode: 409,
          body: 'Extension requires a subscription',
          headers,
        }
      }
      return users
        .updateUser(user.id, {
          publicMetadata: {
            ...user.publicMetadata,
            [extensionField]: {},
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
