const execSync = require("child_process").execSync;

const [_, __, resource, method, id, index] = process.argv;
const API = "r55mcekmol";

execSync(
  `terraform import module.roamjs_lambda.aws_api_gateway_integration.integration[${index}] ${API}/${id}/${method.toUpperCase()}`,
  { stdio: "inherit" }
);
execSync(
  `terraform import module.roamjs_lambda.aws_api_gateway_method.method[${index}] ${API}/${id}/${method.toUpperCase()}`,
  { stdio: "inherit" }
);
execSync(
  `terraform import module.roamjs_lambda.aws_lambda_function.lambda_function[${index}] RoamJS_${resource}_${method}`,
  { stdio: "inherit" }
);
execSync(
  `terraform import module.roamjs_lambda.aws_lambda_permission.apigw_lambda[${index}] RoamJS_${resource}_${method}/AllowExecutionFromAPIGateway`,
  { stdio: "inherit" }
);
execSync(
  `terraform import 'module.roamjs_lambda.aws_api_gateway_integration.mock["${resource}"]' ${API}/${id}/OPTIONS`,
  { stdio: "inherit" }
);
execSync(
  `terraform import 'module.roamjs_lambda.aws_api_gateway_integration_response.mock["${resource}"]' ${API}/${id}/OPTIONS/200`,
  { stdio: "inherit" }
);
execSync(
  `terraform import 'module.roamjs_lambda.aws_api_gateway_method.options["${resource}"]' ${API}/${id}/OPTIONS`,
  { stdio: "inherit" }
);
execSync(
  `terraform import 'module.roamjs_lambda.aws_api_gateway_method_response.mock["${resource}"]' ${API}/${id}/OPTIONS/200`,
  { stdio: "inherit" }
);
execSync(
  `terraform import 'module.roamjs_lambda.aws_api_gateway_resource.resource["${resource}"]' ${API}/${id}`,
  { stdio: "inherit" }
);
