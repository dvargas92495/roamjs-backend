import { APIGatewayProxyHandler } from "aws-lambda";
import samepageRedirect from "./common/samepageRedirect";

export const handler: APIGatewayProxyHandler = samepageRedirect({
  path: "extensions/google/auth",
  headers: {
    "x-google-client-id":
      "950860433572-rvt5aborg8raln483ogada67n201quvh.apps.googleusercontent.com",
    "x-google-client-secret": process.env.GOOGLE_CLIENT_SECRET,
    "x-google-redirect-uri": "https://roamjs.com/oauth?auth=true",
  },
});
