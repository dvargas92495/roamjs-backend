import {
  authenticateDeveloper,
  getStripe,
  getStripePriceId,
  getUser,
  headers,
  idToCamel,
  setupClerk,
} from "./common";
import { users } from "@clerk/clerk-sdk-node";

export const handler = authenticateDeveloper(async (event) => {
  const { quantity = 0, email, id } = JSON.parse(event.body || "{}");
  if (quantity <= 0) {
    return {
      statusCode: 400,
      body: "`quantity` is required and must be greater than 0",
      headers,
    };
  }
  if (!email && !id) {
    return {
      statusCode: 400,
      body: "`id` or `email` is required to meter user",
      headers,
    };
  }
  const hs = event.headers;
  const extension = hs["x-roamjs-extension"] || hs["x-roamjs-service"];
  const dev = !!hs["x-roamjs-dev"];
  const extensionField = idToCamel(extension);
  setupClerk(dev);
  const user = id
    ? await getUser(id).catch(() => undefined)
    : await users.getUserList({ emailAddress: [email] }).then((users) =>
        users.find((u) => !!u.publicMetadata[extensionField])
      );
  if (!user) {
    return {
      statusCode: 409,
      body: `There are no customers with email ${email} or id ${id} subscribed to ${extension}`,
      headers,
    };
  }

  const customer = user.privateMetadata.stripeId as string;
  const stripe = getStripe(dev);
  const priceId = await getStripePriceId(extension, dev);
  const subscriptionItemId = await stripe.subscriptions.list({ customer }).then(
    (s) =>
      s.data
        .flatMap((ss) =>
          ss.items.data.map((si) => ({
            priceId: si.price.id,
            id: si.id,
          }))
        )
        .find(({ priceId: pid }) => priceId === pid)?.id
  );
  if (!subscriptionItemId) {
    return {
      statusCode: 409,
      body: `There is no subscription attached to extension ${extension}`,
      headers,
    };
  }

  return stripe.subscriptionItems
    .createUsageRecord(subscriptionItemId, {
      quantity,
      action: "increment",
      timestamp: Math.floor(new Date().valueOf() / 1000),
    })
    .then((record) => ({
      statusCode: 200,
      body: JSON.stringify({ id: record.id }),
      headers,
    }))
    .catch((e) => ({
      statusCode: e.status || 500,
      body: e.response?.data || e.message,
      headers,
    }));
});
