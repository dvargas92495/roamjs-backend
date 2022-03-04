import { APIGatewayEvent } from "aws-lambda";
import type { Stripe } from "stripe";
import { getStripe, getStripePriceId } from "./common";

const headers = {
  "Access-Control-Allow-Origin": "https://roamresearch.com",
  "Access-Control-Allow-Methods": "POST",
};

export const handler = async (event: APIGatewayEvent) => {
  const { id = "", dev, extensionId = "" } = event.queryStringParameters || {};
  const stripe = getStripe(dev);
  const priceId = extensionId ? await getStripePriceId(extensionId, !!dev) : id;
  return stripe.prices
    .retrieve(priceId, { expand: ["product"] })
    .then((p) => ({
      statusCode: 200,
      body: JSON.stringify({
        id: p.id,
        price: p.unit_amount,
        isMonthly: p.type === "recurring",
        perUse: p.recurring?.usage_type === "metered",
        quantity: p.transform_quantity?.divide_by || 1,
        description: (p.product as Stripe.Product).description,
      }),
      headers,
    }))
    .catch((e) => ({
      statusCode: 500,
      body: e.message,
      headers,
    }));
};
