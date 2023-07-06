import { users } from "@clerk/clerk-sdk-node";
import { authenticateUser, idToCamel, invalidTokenResponse } from "./common";

type Args =
  | {
      method: "GET_USER";
      token: string;
      dev: boolean;
      extension: string;
    }
  | {
      method: "PUT_USER";
      token: string;
      dev: boolean;
      extension: string;
      data: Record<string, unknown>;
    };

export type RoamJSUser = {
  email: string;
  id: string;
  customer?: string;
  [k: string]: unknown;
};

export const handler = async (args: Args) => {
  switch (args.method) {
    case "GET_USER": {
      const { token, dev, extension } = args;
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
      } as RoamJSUser;
    }
    case "PUT_USER": {
      const { token, dev, extension } = args;
      const user = await authenticateUser(token, dev);
      if (!user) {
        return invalidTokenResponse["body"];
      }
      const extensionField = idToCamel(extension);
      if (!user.publicMetadata[extensionField]) {
        throw new Error(
          `User not allowed to access this extension: ${extensionField}`
        );
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
              ...args.data,
            },
          },
        })
        .then(() => ({ success: true }));
    }
    default:
      // @ts-ignore
      throw new Error(`Unknown method: ${args.method}`);
  }
};
