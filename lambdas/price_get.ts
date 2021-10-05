import { APIGatewayEvent } from "aws-lambda";
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2020-08-27",
  maxNetworkRetries: 3,
});
const headers = {
  "Access-Control-Allow-Origin": "https://roamresearch.com",
  "Access-Control-Allow-Methods": "POST",
};

export const handler = async (event: APIGatewayEvent) => {
  const id = event.queryStringParameters?.id || "";
  return stripe.prices
    .retrieve(id)
    .then((p) => ({
      statusCode: 200,
      body: JSON.stringify({
        id: p.id,
        price: p.unit_amount,
        isMonthly: p.type === "recurring",
      }),
      headers,
    }))
    .catch((e) => ({
      statusCode: 500,
      body: e.message,
      headers,
    }));
};
