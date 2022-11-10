import { authenticateUser, idToCamel, invalidTokenResponse } from "./common";

export const handler = async ({
  method,
  token,
  dev,
  extension,
}: {
  method: "GET_USER";
  token: string;
  dev: boolean;
  extension: string;
}) => {
  switch (method) {
    case "GET_USER": {
      const user = await authenticateUser(token, dev);
      if (!user) {
        return invalidTokenResponse["body"];
      }
      const extensionField = idToCamel(extension);
      if (extension && !user.publicMetadata[extensionField]) {
        throw new Error(`User does not currently have any ${extension} data.`);
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
        ...data,
        email: user.emailAddresses.find(
          (e) => e.id === user.primaryEmailAddressId
        )?.emailAddress,
        id: user.id,
      };
    }
    default:
      throw new Error(`Unknown method: ${method}`);
  }
};
