import { Env } from "..";
import { AwsClient } from "../awsfetch";
import { guessIsFolder } from "../utils";

async function getFile(
  aws: AwsClient,
  env: Env,
  path: string
): Promise<Response> {
  // return Response.redirect(`${env.BUCKET_BASEURL}/${path}`, 307);
  const resp = await aws.fetch(`${env.BUCKET_BASEURL}/${path}`, {
    method: "GET",
  });
  let { readable, writable } = new TransformStream();
  if (resp.body == null) return new Response(null, { status: 204, headers: { DAV: "1" } });

  // Start pumping the body. NOTE: No await!
  resp.body.pipeTo(writable);

  // ... and deliver our Response while that’s running.
  return new Response(readable, {headers:{'DAV':'1'},status:resp.status});
}
async function getFolder(aws: AwsClient, env: Env, path: string) {
  return new Response(null, { status: 403 ,headers:{'DAV':'1'}});
}
async function Get(aws: AwsClient, env: Env, request: Request,path:string) {
  return guessIsFolder(path)
    ? await getFolder(aws, env, path)
    : await getFile(aws, env, path);
}
export { Get };
