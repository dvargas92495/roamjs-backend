import { APIGatewayProxyHandler } from "aws-lambda";
import samepageRedirect from "./common/samepageRedirect";

export const handler: APIGatewayProxyHandler = samepageRedirect({
  path: "otter/speeches",
});
