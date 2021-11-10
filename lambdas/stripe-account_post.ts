import type { APIGatewayProxyHandler } from "aws-lambda";
import { users } from "@clerk/clerk-sdk-node";
import { headers, setupClerk, getStripe } from "./common";

export const handler: APIGatewayProxyHandler = async (event) => {
  const { operation, email, dev } = JSON.parse(event.body);
  if (!email) {
    return {
      statusCode: 400,
      body: "`email` is a required parameter.",
      headers,
    };
  }
  setupClerk(dev);
  const stripe = getStripe(dev);
  return users
    .getUserList({ emailAddress: [email] })
    .then((us) => {
      if (!us.length) {
        return {
          statusCode: 401,
          body: `Cannot find RoamJS account with email ${email}.`,
          headers,
        };
      }
      if (operation === "CREATE") {
        const user = us.find((u) => !u.privateMetadata.stripeAccount);
        if (!user) {
          return {
            statusCode: 409,
            body: `No user account available without stripe account.`,
            headers,
          };
        }
        return stripe.accounts
          .create({
            type: "express",
          })
          .then((a) =>
            stripe.accountLinks
              .create({
                account: a.id,
                refresh_url: `https://roamjs.com/oauth?close=true`,
                return_url: `https://roamjs.com/oauth?close=true`,
                type: "account_onboarding",
              })
              .then((l) =>
                users
                  .updateUser(user.id, {
                    privateMetadata: {
                      ...user.privateMetadata,
                      stripeAccount: a.id,
                    },
                  })
                  .then(() => l)
              )
          )
          .then((l) => ({
            statusCode: 200,
            body: JSON.stringify({ url: l.url }),
            headers,
          }));
      } else if (operation === "FINISH") {
        const user = us.find((u) => !!u.privateMetadata.stripeAccount);
        if (!user) {
          return {
            statusCode: 409,
            body: `No Stripe Account in progress`,
            headers,
          };
        }
        return stripe.accounts
          .retrieve(user.privateMetadata.stripeAccount)
          .then((a) => ({
            statusCode: 200,
            body: JSON.stringify({ done: a.details_submitted }),
            headers,
          }))
          .catch((e) => {
            console.error(e);
            return {
              statusCode: 200,
              body: JSON.stringify({ done: false }),
              headers,
            };
          });
      } else if (operation === "RETRY") {
        const user = us.find((u) => !!u.privateMetadata.stripeAccount);
        if (!user) {
          return {
            statusCode: 400,
            body: `No Stripe Account in progress`,
            headers,
          };
        }
        return stripe.accountLinks
          .create({
            account: (user.privateMetadata.stripeAccount as string) || "",
            refresh_url: `https://roamjs.com/oauth?close=true&refresh=true`,
            return_url: `https://roamjs.com/oauth?close=true&return=true`,
            type: "account_onboarding",
          })
          .then((l) => ({
            statusCode: 200,
            body: JSON.stringify({ url: l.url }),
            headers,
          }));
      } else {
        return {
          statusCode: 400,
          body: `Invalid Operation ${operation}`,
          headers,
        };
      }
    })
    .catch((e) => ({
      statusCode: 500,
      body: e.message,
      headers,
    }));
};
