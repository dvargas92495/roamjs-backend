import {
  authenticate,
  authenticateUserShim,
  headers,
  idToCamel,
} from "./common";

const stripeConnectExtensions = ["developer"];

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
          body: "Invalid user token",
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
      const {
        token: storedToken,
        authenticated,
        ...data
      } = (
        user.publicMetadata as {
          [s: string]: { token: string; authenticated: boolean };
        }
      )[extensionField] || ({} as { token: string; authenticated: boolean });
      return {
        statusCode: 200,
        body: JSON.stringify({
          ...data,
          email: user.emailAddresses.find(
            (e) => e.id === user.primaryEmailAddressId
          )?.emailAddress,
          ...(stripeConnectExtensions.includes(extensionField)
            ? { stripeAccountId: user.privateMetadata?.stripeAccount }
            : {}),
        }),
        headers,
      };
    })
    .catch((e) => ({
      statusCode: e.status || 500,
      body: e.response.data || e.message,
      headers,
    }));
});
