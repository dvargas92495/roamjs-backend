import JSZip from "jszip";
import crypto from "crypto";
import rimraf from "rimraf";
import * as esbuild from "esbuild";
import appPath from "../lambdas/common/appPath";
import fs from "fs";
import path from "path";
import { Lambda } from "@aws-sdk/client-lambda";
import getDotEnvObject from "../lambdas/common/getDotEnvObject";

const lambda = new Lambda({
  apiVersion: "2015-03-31",
  region: "us-east-1",
});

const JS_FILE_REGEX = /\.js$/;

const lambdas = async ({
  build,
}: {
  build?: true;
} = {}): Promise<number> => {
  process.env.NODE_ENV =
    process.env.NODE_ENV || (build ? "development" : "production");
  await new Promise((resolve) => rimraf(appPath("out"), resolve));
  return new Promise<number>((resolve, reject) => {
    const entryPoints = Object.fromEntries(
      fs
        .readdirSync("./lambdas/", { withFileTypes: true })
        .filter((f) => !f.isDirectory())
        .map((f) => f.name)
        .map((f) => [f.replace(/\.[t|j]s$/, ""), `./lambdas/${f}`])
    );
    const jsdomPatch: esbuild.Plugin = {
      name: "jsdom-patch",
      setup: (build) => {
        build.onLoad({ filter: /XMLHttpRequest-impl\.js$/ }, async (args) => {
          let contents = await fs.promises.readFile(args.path, "utf8");

          contents = contents.replace(
            'const syncWorkerFile = require.resolve ? require.resolve("./xhr-sync-worker.js") : null;',
            `const syncWorkerFile = null;`
          );

          return { contents, loader: "js" };
        });
      },
    };
    const define = getDotEnvObject();
    return esbuild
      .build({
        entryPoints,
        bundle: true,
        outdir: appPath("out"),
        platform: "node",
        external: ["aws-sdk", "canvas", "re2"],
        minify: !build,
        plugins: [jsdomPatch],
        define,
      })
      .then((r) =>
        r.errors.length
          ? reject(JSON.stringify(r.errors))
          : resolve(r.errors.length)
      )
      .catch(reject);
  }).then((code) => {
    return Promise.all(
      fs
        .readdirSync(appPath("out"), { withFileTypes: true })
        .filter((f) => !f.isDirectory())
        .map((f) => f.name)
        .filter((f) => JS_FILE_REGEX.test(f))
        .map((f) => {
          const zip = new JSZip();
          console.log(`Zipping ${path.join(appPath("out"), f)}...`);
          const content = fs.readFileSync(path.join(appPath("out"), f));
          zip.file(f, content, { date: new Date("09-24-1995") });
          const name = f.replace(/\.js$/, "");
          const shasum = crypto.createHash("sha256");
          const data: Uint8Array[] = [];
          return new Promise<void>((resolve, reject) =>
            zip
              .generateNodeStream({ type: "nodebuffer", streamFiles: true })
              .on("data", (d) => {
                data.push(d);
                shasum.update(d);
              })
              .on("end", () => {
                console.log(`Zip of ${name} complete (${data.length}).`);
                const sha256 = shasum.digest("base64");
                const FunctionName = `RoamJS_${name}`;
                lambda
                  .getFunction({
                    FunctionName,
                  })
                  .then((l) => {
                    if (sha256 === l.Configuration?.CodeSha256) {
                      return `No need to upload ${f}, shas match.`;
                    } else {
                      return build
                        ? new Promise((resolve) =>
                            fs.writeFile(
                              path.join(
                                appPath("out"),
                                f.replace(/\.js$/, ".zip")
                              ),
                              Buffer.concat(data).toString(),
                              () =>
                                resolve(
                                  `Would've uploaded ${f}, wrote zip to disk. Lambda SHA ${l.Configuration?.CodeSha256}. Local SHA ${sha256}.`
                                )
                            )
                          )
                        : lambda
                            .updateFunctionCode({
                              FunctionName,
                              Publish: true,
                              ZipFile: Buffer.concat(data),
                            })
                            .then(
                              (upd) =>
                                `Succesfully uploaded ${f} at ${upd.LastModified}`
                            );
                    }
                  })
                  .then(console.log)
                  .then(resolve)
                  .catch(reject);
              })
          );
        })
    ).then(() => code);
  });
};

(process.env.NODE_ENV === "development" ? lambdas({ build: true }) : lambdas())
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
