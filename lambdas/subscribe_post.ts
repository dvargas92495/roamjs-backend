import { users } from "@clerk/clerk-sdk-node";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  getUserFromEvent,
  getStripePriceId,
  headers,
  getStripe,
  authenticateUser,
  idToCamel,
} from "./common";
import type Stripe from "stripe";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const { extensionId = "", dev = false } = JSON.parse(event.body || "{}") as {
    extensionId: string;
    dev: boolean;
  };
  const token =
    event.headers.Authorization || event.headers.authorization || "";
  return Promise.all([
    getUserFromEvent(token, extensionId, dev),
    authenticateUser(token, dev),
  ]).then(async ([userV2, legacyUser]) => {
    const user = userV2 || legacyUser;
    if (!user) {
      return {
        statusCode: 401,
        body: "Invalid token",
        headers,
      };
    }
    const customer = user.privateMetadata.stripeId as string;
    const stripe = getStripe(dev);
    const priceId = await getStripePriceId(extensionId, dev);
    const line_items = [{ price: priceId, quantity: 1 }];
    const extensionField = idToCamel(extensionId);
    const finishSubscription = () =>
      users
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

    const roamjsSubscription = await stripe.subscriptions
      .list({ customer })
      .then((all) => all.data.find((s) => s.metadata.project === "RoamJS"));
    if (roamjsSubscription) {
      return stripe.subscriptionItems
        .create({
          subscription: roamjsSubscription.id,
          ...line_items[0],
        })
        .then(finishSubscription);
    }

    const paymentMethod = await stripe.customers
      .retrieve(customer)
      .then((c) => c as Stripe.Customer)
      .then((c) => c.invoice_settings?.default_payment_method);

    return (
      paymentMethod
        ? stripe.subscriptions
            .create({
              customer,
              items: line_items,
              metadata: {
                project: "RoamJS",
              },
            })
            .then(finishSubscription)
        : stripe.checkout.sessions
            .create({
              customer,
              payment_method_types: ["card"],
              line_items,
              mode: "subscription",
              success_url: `https://roamjs.com/extensions/${extensionId}?success=true`,
              cancel_url: `https://roamjs.com/extensions/${extensionId}?cancel=true`,
              subscription_data: {
                metadata: {
                  project: "RoamJS",
                },
              },
              metadata: {
                service: extensionField,
                userId: user.id,
                callback: `https://lambda.roamjs.com/finish-subscription`,
              },
            })
            .then((session) => ({
              statusCode: 200,
              body: JSON.stringify({ url: session.url }),
              headers,
            }))
    ).catch(() => ({
      statusCode: 500,
      body: "Failed to subscribe to RoamJS extension. Contact support@roamjs.com for help!",
      headers,
    }));
  });
};
