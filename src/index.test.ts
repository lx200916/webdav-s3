import { unstable_dev } from "wrangler";
import type { UnstableDevWorker } from "wrangler";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { parseDocument } from "htmlparser2";
import {
  findAll,
  getChildren,
  getElements,
  getElementsByTagName,
  getName,
  textContent,
} from "domutils";
import { guessIsFolder, removeNameSpace } from "./utils";

describe("Worker", () => {
  let worker: UnstableDevWorker;

  beforeAll(async () => {
    worker = await unstable_dev("src/index.ts", {
      experimental: { disableExperimentalWarning: true },
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  // it("should return Hello World", async () => {
  // 	const resp = await worker.fetch();
  // 	if (resp) {
  // 		const text = await resp.text();
  // 		expect(text).toMatchInlineSnapshot(`"Hello World!"`);
  // 	}
  // });
  it.skip("Parser Test", async () => {
    const resp = await worker.fetch();
    if (resp) {
      const text = await resp.text();
      console.log(text);
      const document = parseDocument(text);
      // console.log(document);

      //find All `Contents` elements
      const allElements: any[] = [];
      const result = getElementsByTagName(
        "listbucketresult",
        document,
        true,
        1
      );
      // console.log(result[0].children);
      if (result.length > 0) {
        // Get child elements `Key` `Mime` `Size` `LastModified` and turn into object attributes
        getElements(
          { tag_name: "contents" },
          result[0].children,
          false
        ).forEach((element) => {
          // console.log(element);
          let object = new Map();
          getChildren(element).forEach((child) => {
            console.log(child);
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
				  object.set("isFolder",guessIsFolder(object.get("key")));
				  object.set("displayName",object.get("key").split("/").pop());
                  break;

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
        });
        console.log(allElements);
      }else{
		throw new Error("Invalid response")
	  }
    }
  });
  it("Folder Test",async () => {
    expect(guessIsFolder("/")).toBe(true);
  })
  it.skip("WebDAV XML Body Test",async () => {
    const xmlbody = `<?xml version="1.0" encoding="utf-8" ?>
    <D:propfind xmlns:D="DAV:">
        <D:allprop/>
    </D:propfind>
    `
    const document = parseDocument(xmlbody,{xmlMode:true});
    // console.log(document);
    const allElementsName: string[] = [];
    getElementsByTagName((name)=>
      name.includes("propfind")
    ,document,true,1).forEach((element)=>{
      console.log(element);
      switch (removeNameSpace(element.tagName)){ 
        case "propfind":
          return ["propfind"];
        case "allprop":
          return ["allprop"];
        case "prop":
          getChildren(element).forEach((child)=>{
            if(child.type==="tag"){
              allElementsName.push(removeNameSpace(child.tagName));
            }
          })
          return allElementsName;
        default:
          return [];
      }
      
    })




  })
});
