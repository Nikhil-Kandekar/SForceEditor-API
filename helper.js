const fs = require("fs").promises;
const getMimeTypeForExt = (ext) => {
  if (ext === "csv") {
    return "text/csv";
  } else if (ext === "xlsx") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } else if (ext === "xls") {
    return "application/vnd.ms-excel";
  } else if (ext === "txt") {
    return "text/plain";
  } else if (ext === "doc") {
    return "application/msword";
  } else if (ext === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  } else if (ext === "pdf") {
    return "application/pdf";
  } else if (ext === "ppt") {
    return "application/vnd.ms-powerpoint";
  } else if (ext === "pptx") {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  } else if (ext === "rtf") {
    return "application/rtf";
  } else if (ext === "jpeg" || ext === "jpg") {
    return "image/jpeg";
  } else if (ext === "png") {
    return "image/png";
  }
};

async function toDataURL_node(blob) {
  let buffer = Buffer.from(await blob.arrayBuffer());
  return "data:" + blob.type + ";base64," + buffer.toString("base64");
}

async function saveFile(blob, fileName) {
  const buffer = Buffer.from(await blob.arrayBuffer());
  fs.writeFile(fileName, buffer, () =>
    console.log(`file saved as ${fileName}`)
  );
}

function urltoFile(url, filename, mimeType) {
  return fetch(url)
    .then(function (res) {
      return res.arrayBuffer();
    })
    .then(async function (buf) {
      return await fs.writeFile(filename, [buf]);
      //return new File([buf], filename, { type: mimeType });
    });
}

module.exports = { getMimeTypeForExt, toDataURL_node, saveFile, urltoFile };
