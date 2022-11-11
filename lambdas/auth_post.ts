import { APIGatewayProxyHandler } from "aws-lambda";
import AWS from "aws-sdk";
import isAfter from "date-fns/isAfter";
import addMinutes from "date-fns/addMinutes";
import { headers } from "./common";

const dynamo = new AWS.DynamoDB({
  apiVersion: "2012-08-10",
  region: "us-east-1",
});

export const handler: APIGatewayProxyHandler = async (event) => {
  const { service, otp } = JSON.parse(event.body);
  const key = {
    TableName: "RoamJSAuth",
    Key: { id: { S: `${service}_${otp}` } },
  };
  return dynamo
    .getItem(key)
    .promise()
    .then((r) => {
      if (r.Item) {
        return dynamo
          .deleteItem(key)
          .promise()
          .then(() => {
            if (isAfter(new Date(), addMinutes(new Date(r.Item.date.S), 10))) {
              return {
                statusCode: 401,
                body: "otp expired",
                headers,
              };
            } else {
              return {
                statusCode: 200,
                body: JSON.stringify({ auth: r.Item.auth.S }),
                headers,
              };
            }
          });
      } else {
        return {
          statusCode: 204,
          body: JSON.stringify({}),
          headers,
        };
      }
    })
    .catch((e) => ({
      statusCode: 500,
      body: e.message,
      headers,
    }));
};
