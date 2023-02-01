import { getElementsByTagName, getChildren } from "domutils";
import { ElementType, parseDocument } from "htmlparser2";
import { Env } from "..";
import { AwsClient } from "../awsfetch";
import { escapeXML, guessIsFolder, removeNameSpace } from "../utils";
import { APIERROR, HeadObject, ListObjectV2 } from "../aws/api";
const PropNameTemplate = ``;
export async function PropFind(
  aws: AwsClient,
  env: Env,
  request: Request,
  path: string
) {
  const body = await request.text();
  const depth = request.headers.get("depth")?.toLowerCase() ?? "infinity";
  console.log(body.length);
  console.log(depth);

  if (body.length > 0) {
    const props = parsePropReq(body);
    console.log(props);
    if (props.includes("propname")) {
      return await getPropName(aws, env, request, path, depth);
    } else if (props.includes("allprop")) {
    } else {
      return findProps(aws, env, request, path, depth, props);
    }
  } else if (depth === "infinity") {
    return new Response(null, { status: 403 });
  }
  return findProps(aws, env, request, path, depth, [
    "getcontentlength",
    "getlastmodified",
    "resourcetype",
    "getcontenttype",
    "getetag",
    "displayname",
  ]);
}

function parsePropReq(body: string) {
  const document = parseDocument(body, { xmlMode: true });
  // console.log(document);
  const allElementsName: string[] = [];
  let elements = getElementsByTagName(
    (name) => name.includes("propfind"),
    document,
    true,
    1
  );
  if (elements.length == 0) {
    throw new Error("Invalid request");
  }
  let childElements = getChildren(elements[0]);
  if (childElements.length == 0) {
    throw new Error("Invalid request");
  }
  let element: Element = childElements.filter(
    (ele) => ele.type == ElementType.Tag
  )[0] as unknown as Element;

  // console.log(element.tagName);
  switch (removeNameSpace(element.tagName)) {
    case "propname":
      return ["propname"];
    case "allprop":
      return ["allprop"];
    case "prop":
      //@ts-ignore
      getChildren(element).forEach((child) => {
        if (child.type === "tag") {
          allElementsName.push(removeNameSpace(child.tagName));
        }
      });
      return allElementsName;
    default:
    //Maybe <includes> we dont care.
  }
  return [];
}
async function getPropName(
  aws: AwsClient,
  env: Env,
  request: Request,
  path: string,
  depth: string
) {
  if (depth == "0") {
    const resp = `
            <?xml version="1.0" encoding="utf-8" ?> 
<multistatus xmlns="DAV:"> 
<response> 
<href>${path}</href> 
<propstat> 
    <prop> 
      
      ${
        guessIsFolder(path)
          ? `<resourcetype/>`
          : `<resourcetype/><getlastModified/>
          <getcontentlength/>
          <getcontenttype/>`
      }
    </prop> 
    <status>HTTP/1.1 200 OK</status> 
</propstat> 
</response> </multistatus>`;
    return new Response(resp, {
      status: 207,
      headers: { "Content-Type": "application/xml","DAV":"1" },
    });
  } else {
    const files = await ListObjectV2(aws, env, path);
    const resp = `
            <?xml version="1.0" encoding="utf-8" ?> 
<multistatus xmlns="DAV:"> 
${files
  .map((file) => {
    return `<response> 
        <href>/${file.get("key")}</href> 
        <propstat> 
            <prop> 
            ${
              file.get("isFolder")
                ? `<resourcetype/>`
                : `<resourcetype/><getlastModified/>
                <getcontentlength/>
                <getcontenttype/>`
            }
            
            </prop> 
            <status>HTTP/1.1 200 OK</status> 
        </propstat> 
        </response>`;
  })
  .join("")}
 </multistatus>`;
    console.log(resp);

    return new Response(resp, {
      status: 207,
      headers: { "Content-Type": "application/xml","DAV":"1" },
    });
  }
}
async function findProps(
  aws: AwsClient,
  env: Env,
  request: Request,
  path: string,
  depth: string,
  props: string[]
) {
  let resp = "";
  try {
    if (depth == "0") {
      const fileinfo = guessIsFolder(path)
        ? null
        : await HeadObject(aws, env, path);

      resp = `
            <?xml version="1.0" encoding="utf-8" ?>
<multistatus xmlns="DAV:">
<response>
<href>${escapeXML( path)}</href>
<propstat>
<prop> 
${
  guessIsFolder(path)
    ? `<resourcetype><collection/></resourcetype>`
    : props
        .map((prop) => {
          switch (prop) {
            case "getlastModified":
              return `<getlastModified>${
                escapeXML(fileinfo?.lastModified?.toISOString() ?? "")
              }</getlastModified>`;
            case "getcontentlength":
              return `<getcontentlength>${
                escapeXML(fileinfo?.size ?? "")
              }</getcontentlength>`;
            case "getcontenttype":
              return `<getcontenttype>${escapeXML(fileinfo?.mime)}</getcontenttype>`;
            case "resourcetype":
              return ``;
            default:
              return ``;
          }
        })
        .join("")
}
<resourcetype/>
</prop>
<status>HTTP/1.1 200 OK</status> 
</propstat>
</response> </multistatus>`;
    } else {
      console.log("findProps", path);

      if (!guessIsFolder(path)) {
        return new Response(null, { status: 403 ,headers:{"DAV":"1"}});
      }
      const fileinfos = await ListObjectV2(aws, env, path);
      console.log(fileinfos);
      resp = `
            <?xml version="1.0" encoding="utf-8" ?>
<multistatus xmlns="DAV:">
${fileinfos
  .map((fileinfo) => {
    console.log(fileinfo.get("key"));
    return `<response>
        <href>/${escapeXML(fileinfo.get("key"))}</href>
        <propstat>
        <prop> 

        ${
          fileinfo.get("isFolder")
            ? `<resourcetype><collection/></resourcetype>`
            : props
                .map((prop) => {
                  switch (prop) {
                    case "getlastModified":
                      return `<getlastModified>${
                        escapeXML(fileinfo.get("lastModified")?.toISOString() ?? "")
                      }</getlastModified>`;
                    case "getcontentlength":
                      return `<getcontentlength>${
                        escapeXML(fileinfo.get("size") ?? "")
                      }</getcontentlength>`;
                    case "getcontenttype":
                      return `<getcontenttype>${escapeXML(fileinfo.get(
                        "mime"
                      ))}</getcontenttype>`;
                    case "displayname":
                      return `<displayname>${escapeXML(fileinfo.get(
                        "displayName"
                      ))}</displayname>`;
                    default:
                      return ``;
                  }
                })
                .join("")
        }
        <resourcetype/>
        </prop>
<status>HTTP/1.1 200 OK</status> 
        </propstat>
        </response>`;
  })
  .join("")}
 </multistatus>`;
    }
    return new Response(resp, {
      status: 207,
      headers: { "Content-Type": "application/xml", "DAV": "1" },
    });
  } catch (err) {
    if (err instanceof APIERROR) {
      return new Response(err.message, {
        status: err.status,
        headers: { "Content-Type": "text/plain" ,'DAV': '1'},
      });
    } else {
      throw err;
    }
  }
}
