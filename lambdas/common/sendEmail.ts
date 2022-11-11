import AWS from "aws-sdk";
import type React from "react";
import ReactDOMServer from "react-dom/server";

const ses = new AWS.SES();

const sendEmail = ({
  to,
  body,
  subject,
  from,
  replyTo,
}: {
  to?: string | string[];
  body: React.ReactElement | string;
  subject: string;
  from?: string;
  replyTo?: string | string[];
}): Promise<string> =>
  ses
    .sendEmail({
      Destination: {
        ToAddresses: typeof to === "string" ? [to] : to,
      },
      Message: {
        Body: {
          Html: {
            Charset: "UTF-8",
            Data:
              typeof body === "string"
                ? body
                : ReactDOMServer.renderToStaticMarkup(body),
          },
        },
        Subject: {
          Charset: "UTF-8",
          Data: subject,
        },
      },
      Source: from,
      ReplyToAddresses: typeof replyTo === "string" ? [replyTo] : replyTo,
    })
    .promise()
    .then((r) => r.MessageId);

export default sendEmail;
