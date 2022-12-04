import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { dynamo, roamjsHeaders as headers } from "./common";

const emptyResponse = {
  statusCode: 204,
  body: JSON.stringify({}),
  headers,
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const { service, otp, auth } = JSON.parse(event.body);
  return dynamo
    .putItem({
      TableName: "RoamJSAuth",
      Item: {
        id: { S: `${service}_${otp}` },
        auth: { S: auth },
        date: { S: new Date().toJSON() },
      },
    })
    .promise()
    .then(() => emptyResponse);
};
