function guessIsFolder(path:string){
    // TODO: According to WebDav documentation, we assume that the path ends with "/" means it is a folder.
    return path.endsWith("/")
}
function removeNameSpace(tagName:string,lowerCase=true){
    tagName=lowerCase?tagName.toLowerCase():tagName;
    return tagName.split(":").pop()??tagName;
}
function escapeXML(str:string|null|undefined) {
    if(!str) return '';
    return str.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&apos;');
  };
export {
    guessIsFolder,
    removeNameSpace,
    escapeXML
}