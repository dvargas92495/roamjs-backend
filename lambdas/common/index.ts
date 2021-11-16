import Stripe from "stripe";
import { setClerkApiKey, users, User } from "@clerk/clerk-sdk-node";
import type { APIGatewayProxyHandler } from "aws-lambda";
import AWS from "aws-sdk";

export const ses = new AWS.SES({ apiVersion: "2010-12-01" });
export const dynamo = new AWS.DynamoDB({ apiVersion: "2012-08-10" });

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

export const getTableName = (dev: boolean) =>
  dev ? "RoamJSExtensionsDev" : "RoamJSExtensions";

export const getStripePriceId = (
  service: string,
  dev: boolean
): Promise<string> =>
  dynamo
    .getItem({
      TableName: getTableName(dev),
      Key: { id: { S: service } },
    })
    .promise()
    .then((r) => r.Item.premium?.S);

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
                    Data: `An error was thrown in a RoamJS lambda trying to get user ${userId}:

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
  (handler: APIGatewayProxyHandler): APIGatewayProxyHandler =>
  (event, ctx, callback) => {
    const Authorization =
      event.headers.Authorization || event.headers.authorization || "";

    return getUserFromEvent(Authorization, "developer").then((user) => {
      if (!user) {
        return {
          statusCode: 401,
          body: "Invalid token",
          headers,
        };
      }
      event.requestContext.authorizer = { user };
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
