import {
  authenticateUser,
  getUserFromEvent,
  headers,
  idToCamel,
} from "./common";
import { APIGatewayProxyHandler } from "aws-lambda";

export const handler: APIGatewayProxyHandler = async (event) => {
  const { extensionId = "", dev } = event.queryStringParameters || {};
  const token =
    event.headers.Authorization || event.headers.authorization || "";
  return Promise.all([
    getUserFromEvent(token, extensionId, !!dev),
    authenticateUser(token, !!dev),
  ])
    .then(async ([userV2, legacyUser]) => {
      const user = userV2 || legacyUser;
      if (!user) {
        return {
          statusCode: 401,
          body: "Invalid token",
          headers,
        };
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
