import { setClerkApiKey, users } from "@clerk/clerk-sdk-node";
import { APIGatewayProxyHandler } from "aws-lambda";
import { headers } from "./common";

export const handler: APIGatewayProxyHandler = (event) => {
  const { email = "", dev } = JSON.parse(event.body || '{}');
  if (dev) {
    setClerkApiKey(process.env.CLERK_DEV_API_KEY);
  } else {
    setClerkApiKey(process.env.CLERK_API_KEY);
  }
  return users
    .getUserList({ emailAddress: [email] })
    .then((users) => {
      return {
        statusCode: 200,
        body: JSON.stringify({
          exists: !!users.length,
        }),
        headers,
      };
    })
    .catch(() => ({
      statusCode: 200,
      body: JSON.stringify({
        exists: false,
      }),
      headers,
    }));
};
