import {
  authenticateUser,
  headers,
  idToCamel,
  invalidTokenResponse,
} from "./common";
import { APIGatewayProxyHandler } from "aws-lambda";

export const handler: APIGatewayProxyHandler = async (event) => {
  const { extensionId = "", dev } = event.queryStringParameters || {};
  const token =
    event.headers.Authorization || event.headers.authorization || "";
  return authenticateUser(token, !!dev).then(async (user) => {
      if (!user) {
        return invalidTokenResponse;
      }
      const extensionField = idToCamel(extensionId);
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: !!user.publicMetadata[extensionField],
        }),
        headers,
      };
    })
    .catch((e) => ({
      statusCode: e.status || 500,
      body: e.response.data || e.message,
      headers,
    }));
};
