import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import addMinutes from "date-fns/addMinutes";
import isAfter from "date-fns/isAfter";
import { dynamo, roamjsHeaders as headers } from "./common";

const bareSuccessResponse = {
  statusCode: 200,
  body: JSON.stringify({ success: true }),
  headers,
};

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
      if (r.Item) {
        if (isAfter(new Date(), addMinutes(new Date(r.Item.date.S), 10))) {
          return dynamo
            .deleteItem(key)
            .promise()
            .then(() => bareSuccessResponse);
        } else {
          return {
            statusCode: 200,
            body: JSON.stringify({ success: false }),
            headers,
          };
        }
      } else {
        return bareSuccessResponse;
      }
    })
    .catch((e) => ({
      statusCode: 500,
      body: e.message,
      headers,
    }));
};
