import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { roamjsHeaders as headers, getStripe } from "./common";
import { awsGetRoamJSUser } from "./common/getRoamJSUser";

export const handler = awsGetRoamJSUser(async (user) => {
  if (!user) {
    return {
      statusCode: 401,
      body: "No Active Session",
      headers,
    };
  }
  const stripe = getStripe();
  const { customer } = user;
  return stripe.checkout.sessions
    .create({
      customer,
      payment_method_types: ["card"],
      mode: "setup",
      success_url: `https://roamjs.com/user`,
      cancel_url: `https://roamjs.com/user`,
    })
    .then((session) => ({
      statusCode: 200,
      body: JSON.stringify({ id: session.id, active: false }),
      headers,
    }))
    .catch((e) => ({
      statusCode: 500,
      body: e.errorMessage || e.message,
      headers,
    }));
});
