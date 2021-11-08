import Stripe from "stripe";
import { setClerkApiKey, users, User } from "@clerk/clerk-sdk-node";
import type { APIGatewayProxyHandler } from "aws-lambda";
import AWS from "aws-sdk";

export const ses = new AWS.SES({ apiVersion: "2010-12-01" });

export const headers = {
  "Access-Control-Allow-Origin": "https://roamresearch.com",
};

export const getStripe = (dev?: boolean | string) =>
  new Stripe(
    (dev ? process.env.STRIPE_DEV_SECRET_KEY : process.env.STRIPE_SECRET_KEY) ||
      "",
    {
      apiVersion: "2020-08-27",
    }
  );

export const setupClerk = (dev?: boolean | string) => {
  if (dev) {
    setClerkApiKey(process.env.CLERK_DEV_API_KEY);
  } else {
    setClerkApiKey(process.env.CLERK_API_KEY);
  }
};

const findUser = async (predicate: (u: User) => boolean): Promise<User> => {
  let offset = 0;
  while (offset < 10000) {
    const us = await users.getUserList({ limit: 100, offset });
    const user = us.find(predicate);
    if (user) {
      return user;
    }
    if (us.length < 100) {
      return;
    }
    offset += us.length;
  }
};

export const getUserFromEvent = (
  Authorization: string,
  service: string,
  dev?: boolean
): Promise<User> => {
  if (dev) {
    setClerkApiKey(process.env.CLERK_DEV_API_KEY);
  } else {
    setClerkApiKey(process.env.CLERK_API_KEY);
  }
  const [userId, token] =
    Authorization.length === 32 || Authorization.includes(":")
      ? // the old ways of generating tokens did not have user id encoded, so we query all users
        [
          null,
          Authorization.split(":").slice(-1)[0],
          Authorization.split(":").slice(-1)[0],
        ]
      : [
          Buffer.from(Authorization, "base64").toString().split(":")[0],
          Authorization,
          Buffer.from(Authorization, "base64").toString().split(":")[1],
        ];

  return userId
    ? users
        .getUser(`user_${userId}`)
        .then((user) =>
          (user.publicMetadata as { [s: string]: { token: string } })?.[service]
            ?.token === token
            ? user
            : undefined
        )
        .catch((e) => {
          return ses
            .sendEmail({
              Destination: {
                ToAddresses: ["dvargas92495@gmail.com"],
              },
              Message: {
                Body: {
                  Text: {
                    Charset: "UTF-8",
                    Data: `An error was thrown in a RoamJS lambda:

${e.name}: ${e.message}
${e.stack}`,
                  },
                },
                Subject: {
                  Charset: "UTF-8",
                  Data: `RoamJS Error: Getting User From Clerk`,
                },
              },
              Source: "support@roamjs.com",
            })
            .promise()
            .then(() => undefined);
        })
    : findUser(
        (user) =>
          (user.publicMetadata as { [s: string]: { token: string } })?.[service]
            ?.token === token
      );
};

export const authenticate =
  (
    handler: APIGatewayProxyHandler,
    inputService?: "staticSite" | "social" | "developer"
  ): APIGatewayProxyHandler =>
  (event, ctx, callback) => {
    const service = inputService || event.queryStringParameters.service;
    const Authorization =
      event.headers.Authorization || event.headers.authorization || "";
    const dev = !!event.headers["x-roamjs-dev"];

    return getUserFromEvent(Authorization, service, dev).then((user) => {
      if (!user) {
        console.log(
          "Failed to authenticate",
          Authorization.slice(-5),
          service,
          dev
        );
        return {
          statusCode: 401,
          body: "Invalid token",
          headers,
        };
      }
      const publicMetadata = user.publicMetadata;
      const serviceData = (
        publicMetadata as {
          [s: string]: { authenticated: boolean };
        }
      )[service];
      if (!serviceData.authenticated) {
        users.updateUser(user.id, {
          publicMetadata: {
            ...publicMetadata,
            [service]: {
              ...serviceData,
              authenticated: true,
            },
          },
        });
      }
      event.headers.Authorization = user.id;
      const result = handler(event, ctx, callback);
      if (!result) {
        return {
          statusCode: 204,
          body: "",
          headers,
        };
      }
      return result;
    });
  };
