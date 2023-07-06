import {
  authenticateDeveloper,
  authenticateUser,
  headers,
  idToCamel,
  invalidTokenResponse,
} from "./common";

export const handler = authenticateDeveloper(async (event) => {
  const hs = event.headers;
  const extension = hs["x-roamjs-extension"] || hs["x-roamjs-service"] || "";
  const token = hs["x-roamjs-token"];
  const dev = !!hs["x-roamjs-dev"];
  return authenticateUser(token, dev)
    .then(async (user) => {
      if (!user) {
        return invalidTokenResponse;
      }
      const extensionField = idToCamel(extension);
      if (extension && !user.publicMetadata[extensionField]) {
        return {
          statusCode: 403,
          body: `User does not currently have any ${extension} data.`,
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
          id: user.id,
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
