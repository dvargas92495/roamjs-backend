import { APIGatewayEvent } from "aws-lambda";
import { getStripe } from "./common";

const headers = {
  "Access-Control-Allow-Origin": "https://roamresearch.com",
  "Access-Control-Allow-Methods": "POST",
};

export const handler = async (event: APIGatewayEvent) => {
  const { id = "", dev } = event.queryStringParameters || {};
  const stripe = getStripe(dev);
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
