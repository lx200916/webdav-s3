import { Env } from "..";
import { AwsClient } from "../awsfetch";
import { guessIsFolder } from "../utils";

async function getFile(
  aws: AwsClient,
  env: Env,
  path: string,request:Request
): Promise<Response> {
  // return Response.redirect(`${env.BUCKET_BASEURL}/${path}`, 302);
  const resp = await aws.fetch(`${env.BUCKET_BASEURL}/${path}`, {
    method: "GET",
    headers: request.headers.get("range")?  {
      "range":request.headers.get("range")!,
    }:undefined,
  });
  let { readable, writable } = new TransformStream();
  if (resp.body == null) return new Response(null, { status: 204, headers: { DAV: "1" } });

  resp.body.pipeTo(writable);
  let respHeaders = new Headers(resp.headers);
  respHeaders.set("DAV", "1");

  return new Response(readable, {headers:respHeaders,status:resp.status});
}
async function getFolder(aws: AwsClient, env: Env, path: string) {
  return new Response(null, { status: 403 ,headers:{'DAV':'1'}});
}
async function Get(aws: AwsClient, env: Env, request: Request,path:string) {
  return guessIsFolder(path)
    ? await getFolder(aws, env, path)
    : await getFile(aws, env, path,request);
}
export { Get };
