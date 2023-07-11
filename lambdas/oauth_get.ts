import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { dynamo, roamjsHeaders as headers } from "./common";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const S = event.queryStringParameters?.state || "";
  const key = {
    TableName: "RoamJSAuth",
    Key: { id: { S } },
  };
  return dynamo
    .getItem(key)
    .promise()
    .then((r) => {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: !r.Item }),
        headers,
      };
    })
    .catch((e) => ({
      statusCode: 500,
      body: e.message,
      headers,
    }));
};
