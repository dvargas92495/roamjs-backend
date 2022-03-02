import { users } from "@clerk/clerk-sdk-node";
import {
  authenticate,
  authenticateUserShim,
  getStripePriceId,
  headers,
  idToCamel,
  invalidToken,
} from "./common";

export const handler = authenticate(async (event) => {
  const hs = event.headers;
  const extension = hs["x-roamjs-extension"] || hs["x-roamjs-service"];
  const token = hs["x-roamjs-token"];
  const dev = !!hs["x-roamjs-dev"];
  return authenticateUserShim(token, extension, dev)
    .then(async (user) => {
      if (!user) {
        return invalidToken;
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
