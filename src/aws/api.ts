import {
  getElementsByTagName,
  getElements,
  getChildren,
  textContent,
} from "domutils";
import { parseDocument } from "htmlparser2";
import { Env } from "..";
import { AwsClient } from "../awsfetch";
import { escapeXML, guessIsFolder } from "../utils";
export class APIERROR extends Error {
  status: number;
  msg: string;
  constructor(status: number, msg: string) {
    super(msg);
    this.status = status;
    this.msg = msg;
  }
}
function checkResponseStatus(
  response: Response | null,
  allowedCode: number[] = [200]
): Response {
  if (!response) throw new APIERROR(500, "No response");
  if (response.status > 400 && !allowedCode.includes(response.status)) {
    throw new APIERROR(response.status, response.statusText);
  }
  return response;
}
export class FileInfo {
  key: string = "";
  mime: string = "application/octet-stream";
  size: string = "";
  lastModified: Date | null = null;
  etag: string | null = null;
  isFolder: boolean = false;
  displayName: string = "";
  headers: Headers | null = null;
}
export const AWSAPIEndpoints = {
  // List of endpoints of S3
  ListObjectV2: ["GET", "{BASEURL}?list-type=2&prefix={PATH}"],
  HeadObject: ["HEAD", "{BASEURL}{PATH}"],
  DeleteObject: ["DELETE", "{BASEURL}/{PATH}"],
  PutObject: ["PUT", "{BASEURL}{PATH}"],
  DeleteObjects: ["POST", "{BASEURL}?delete"],
  // Add `x-amz-copy-source` for object source: {BUCKET}/reports/january.pdf
  //See https://docs.aws.amazon.com/AmazonS3/latest/API/API_CopyObject.html for more details
  CopyObject: ["PUT", "{BASEURL}{PATH}"],
};

async function CopyObject(
  aws: AwsClient,
  env: Env,
  path: string,
  destination: string
) {
  if (!path.startsWith("/")) path = "/" + path;
  let url = AWSAPIEndpoints.CopyObject[1]
    .replace("{BASEURL}", env.BUCKET_BASEURL)
    .replace("{PATH}", path);
  let BUCKET = env.BUCKET_BASEURL.split("//")[1].split(".")[0];
  let resp = await aws.fetch(url, {
    method: AWSAPIEndpoints.CopyObject[0],
    headers: {
      "x-amz-copy-source": `${BUCKET}${path}`,
    },
  });
  if (checkResponseStatus(resp)) {
    const document = parseDocument(await resp.text());
    const errors = getElementsByTagName("error", document, true);
    if (errors.length > 0) {
      const err = errors[0];
      const code = getElementsByTagName("code", err, true, 1)[0];
      const message = getElementsByTagName("message", err, true, 1)[0];
      throw new APIERROR(403,`${textContent(code)}: ${textContent(message)}`);
    } else {
      return new Response(resp.body,{headers:{'DAV':'1'},status:resp.status});
    }
  } else {
    throw new Error("Invalid response");
  }
}
async function ListObjectV2(
  aws: AwsClient,
  env: Env,
  path: string
): Promise<any[]> {
  let url = AWSAPIEndpoints.ListObjectV2[1]
    .replace("{BASEURL}", env.BUCKET_BASEURL)
    .replace("{PATH}", path);
  let resp = await aws.fetch(url, {
    method: AWSAPIEndpoints.ListObjectV2[0],
  });
  if (checkResponseStatus(resp)) {
    const text = await resp.text();
    // console.log(text);
    const document = parseDocument(text);
    const allElements: any[] = [];
    const result = getElementsByTagName("listbucketresult", document, true, 1);
    const errors = getElementsByTagName("error", document, true);
    // console.log(result[0].children);
    if (errors.length > 0) {
      const err = errors[0];
      const code = getElementsByTagName("code", err, true, 1)[0];
      const message = getElementsByTagName("message", err, true, 1)[0];
      throw new Error(`${textContent(code)}: ${textContent(message)}`);
    } else if (result.length > 0) {
      // Get child elements `Key` `Mime` `Size` `LastModified` and turn into object attributes
      getElements({ tag_name: "contents" }, result[0].children, false).forEach(
        (element) => {
          // console.log(element);
          let object = new Map();
          getChildren(element).forEach((child) => {
            // console.log(child);
            if (child.type === "tag") {
              switch (child.tagName) {
                case "lastmodified":
                  object.set(
                    "lastModified",
                    child.firstChild ? textContent(child.firstChild) : null
                  );
                  break;
                case "key":
                  object.set(
                    "key",
                    child.firstChild ? textContent(child.firstChild) : null
                  );
                  object.set("isFolder", guessIsFolder(object.get("key")));
                  object.set("displayName", object.get("key").split("/").pop());
                  break;
                case "mime":
                  object.set(
                    "mime",
                    child.firstChild
                      ? textContent(child.firstChild)
                      : "application/octet-stream"
                  );
                default:
                  object.set(
                    child.tagName,
                    child.firstChild ? textContent(child.firstChild) : null
                  );
                  break;
              }
            }
          });
          allElements.push(object);
        }
      );
      return allElements;
    } else {
      throw new Error("Invalid response");
    }
  } else {
    throw new Error("Request failed");
  }
}
async function HeadObject(aws: AwsClient, env: Env, path: string) {
  let url = AWSAPIEndpoints.HeadObject[1]
    .replace("{BASEURL}", env.BUCKET_BASEURL)
    .replace("{PATH}", path);
  let resp = await aws.fetch(url, {
    method: AWSAPIEndpoints.HeadObject[0],
  });
  if (checkResponseStatus(resp)) {
    let fileInfo = new FileInfo();
    const headers = resp.headers;
    // console.log(headers);
    fileInfo.mime = headers.get("content-type") ?? "application/octet-stream";
    fileInfo.key = path;
    fileInfo.size = headers.get("content-length") ?? "0";
    fileInfo.isFolder = guessIsFolder(path);
    fileInfo.etag = headers.get("etag");
    fileInfo.lastModified = headers.get("last-modified")
      ? new Date(headers.get("last-modified")!)
      : null;
    fileInfo.displayName = path.split("/").pop() ?? path;
    fileInfo.headers = headers;
    return fileInfo;
  } else {
    throw new APIERROR(500, "Request failed");
  }
}
async function DeleteObjects(aws: AwsClient, env: Env, path: string[]) {
  let url = AWSAPIEndpoints.DeleteObjects[1].replace(
    "{BASEURL}",
    env.BUCKET_BASEURL
  );

  let resp = await aws.fetch(url, {
    method: AWSAPIEndpoints.DeleteObjects[0],
    body: `
        <Delete xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
        ${path
          .map((p) => `<Object><Key>${escapeXML(p)}</Key></Object>`)
          .join("")}
   <Quiet>true</Quiet>
</Delete>`,
  });
  if (checkResponseStatus(resp)) {
    const text = await resp.text();
    if (text.length == 0) return resp;
    const document = parseDocument(text);
    const errors = getElementsByTagName("error", document, true);
    if (errors.length > 0) {
      const err = errors[0];
      const code = getElementsByTagName("code", err, true, 1)[0];
      const message = getElementsByTagName("key", err, true, 1)[0];
      console.error(`DeleteOBJs ${textContent(code)}: ${textContent(message)}`);
      throw new APIERROR(
        Number(textContent(code)) ? Number(textContent(code)) : 403,
        textContent(message)
      );
    } else {
      return new Response(resp.body,{headers:{'DAV':'1'},status:resp.status});
    }
  } else {
    throw new Error("Invalid response");
  }
}
async function DeleteObject(aws: AwsClient, env: Env, path: string) {
  let url = AWSAPIEndpoints.DeleteObject[1]
    .replace("{BASEURL}", env.BUCKET_BASEURL)
    .replace("{PATH}", path);
  let resp = await aws.fetch(url, {
    method: AWSAPIEndpoints.DeleteObject[0],
  });
  if (checkResponseStatus(resp)) {
    const document = parseDocument(await resp.text());
    const errors = getElementsByTagName("error", document, true);
    if (errors.length > 0) {
      const err = errors[0];
      const code = getElementsByTagName("code", err, true, 1)[0];
      const message = getElementsByTagName("message", err, true, 1)[0];
      throw new APIERROR(
        Number(textContent(code)) ? Number(textContent(code)) : 403,
        textContent(message)
      );
    } else {

      return new Response(resp.body,{headers:{'DAV':'1'},status:resp.status});
    }
  } else {
    throw new Error("Invalid response");
  }
}
async function PutObject(
  aws: AwsClient,
  env: Env,
  path: string,
  file: ArrayBuffer,
  contentType: string
) {
  let url = AWSAPIEndpoints.PutObject[1]
    .replace("{BASEURL}", env.BUCKET_BASEURL)
    .replace("{PATH}", path);
  // console.log(file)
  // console.log(url)

  let resp = await aws.fetch(url, {
    method: AWSAPIEndpoints.PutObject[0],
    body: file,
    headers: {
      "Content-Type": contentType,
    },
  });

  if (checkResponseStatus(resp)) {
    const document = parseDocument(await resp.text());
    const errors = getElementsByTagName("error", document, true);
    if (errors.length > 0) {
      const err = errors[0];
      const code = getElementsByTagName("code", err, true, 1)[0];
      const message = getElementsByTagName("message", err, true, 1)[0];
      throw new APIERROR(500,`${textContent(code)}: ${textContent(message)}`);
    } else {
      return new Response(resp.body,{headers:{'DAV':'1'},status:resp.status});

    }
  } else {
    throw new Error("Invalid response");
  }
}
export { ListObjectV2, DeleteObject, HeadObject, PutObject, DeleteObjects,CopyObject };
