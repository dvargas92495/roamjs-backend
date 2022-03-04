import { users } from "@clerk/clerk-sdk-node";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  getStripePriceId,
  headers,
  getStripe,
  authenticateUser,
  idToCamel,
  invalidTokenResponse,
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
  return authenticateUser(token, dev).then(async (user) => {
      if (!user) {
        return invalidTokenResponse;
      }
      const customer = user.privateMetadata.stripeId as string;
      const stripe = getStripe(dev);
      const priceId = await getStripePriceId(extensionId, dev);
      const usage = await stripe.prices
        .retrieve(priceId)
        .then((p) => p.recurring?.usage_type);
      const line_items = [
        usage === "metered"
          ? { price: priceId }
          : { price: priceId, quantity: 1 },
      ];
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

      return paymentMethod
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
                extension: extensionField,
                userId: user.id,
                callback: `https://lambda.roamjs.com/finish-subscription`,
              },
            })
            .then((session) => ({
              statusCode: 200,
              body: JSON.stringify({ url: session.url }),
              headers,
            }));
    })
    .catch((e) => ({
      statusCode: 500,
      body: `Failed to subscribe to RoamJS extension: ${e.message}. Contact support@roamjs.com for help!`,
      headers,
    }));
};
