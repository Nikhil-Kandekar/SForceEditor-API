const fs = require("fs").promises;
const mammoth = require("mammoth");
const { read, utils } = require("./sheetjs/xlsx");
const pdfcrowd = require("pdfcrowd");
const pdfConClient = new pdfcrowd.PdfToHtmlClient(
  "demo",
  "ce544b6ea52a5621fb9d55f8b542d14d"
);

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

async function processExcel(resp, name, ext, contentDocumentId) {
  const f = await resp.arrayBuffer();
  const wb = read(f);
  const data = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  let headers = Object.keys(data[0]);
  let tempMap = {};
  headers.forEach((ele) => {
    tempMap[ele] = ele;
  });
  if (JSON.stringify(tempMap) !== JSON.stringify(data[0]))
    data.unshift(tempMap);
  console.log(data);

  let script = `<script>
    let cols = ${JSON.stringify(headers.map((h) => ({ data: h })))}
    let headers = ${JSON.stringify(headers)}
    let data = ${JSON.stringify(data)}
    let ext = '${ext}'
    let name = '${name}'
    let mimeType = '${getMimeTypeForExt(ext)}'
    let conDocId = '${contentDocumentId}'
  </script>`;

  return { template: "luckysheet", options: { script } }; // return { template: "handontable", options: { script } };
}

async function processExcelBlob(resp, name, ext, contentDocumentId) {
  const f = await resp.arrayBuffer();
  const base64Blob = Buffer.from(new Uint8Array(f)).toString("base64");
  console.log("f => ", f);

  const wb = read(f);
  const data = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  let headers = Object.keys(data[0]);
  let tempMap = {};
  headers.forEach((ele) => {
    tempMap[ele] = ele;
  });
  data.unshift(tempMap);

  let script = `<script>
    let cols = ${JSON.stringify(headers.map((h) => ({ data: h })))}
    let headers = ${JSON.stringify(headers)}
    let data = ${JSON.stringify(data)}
    let ext = '${ext}'
    let mimeType = '${getMimeTypeForExt(ext)}'
    let name = '${name}'
    let conDocId = '${contentDocumentId}'
    let base64Blob = '${base64Blob}'
  </script>`;

  return { template: "luckysheetCsv", options: { script } };
}

async function processText(resp, name, ext, contentDocumentId) {
  const dataBlob = await resp.blob();
  let data = await dataBlob.text();
  data = "<p>" + data;
  data = data.split("\n").join("<br/>");
  data = data.split("\r\n").join("<br />");
  data += "</p>";

  let script = `<script>
    const save = document.querySelector('#save');
    save.addEventListener('click', () => {
      save.disabled = true;
      document.querySelector('#status').innerText = 'Hang tight! Saving data to salesforce...';
      fetch('/saveTextData', {
        method: 'POST',
        //mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            data: _editor.getData(), 
            ext: '${ext}', 
            name: '${name}', 
            conDocId: '${contentDocumentId}' 
        })
      })
      .then(response => {
          document.querySelector('#status').innerText = 'Data saved';
          console.log('The POST request is only used here for the demo purposes');
          save.disabled = false;
      })
      .catch((err) => {
          document.querySelector('#status').innerText = err.message;
          save.disabled = false;
      })
    })
  </script>`;

  return { template: "textEditor", options: { data, script } };
}

function htmlToText(data) {
  let _data = data.replaceAll("</p><p>", "\n\n");
  _data = _data.replaceAll("&nbsp;<br><br>", "\n\n");
  _data = _data.replaceAll("<br>", "\n");
  _data = _data.replaceAll("<br/>", "\n");
  _data = _data.replaceAll("<p>", "");
  _data = _data.replaceAll("</p>", "");
  return _data;
}

async function processDoc(resp, ext, name, contentDocumentId) {
  const dataBlob = await resp.blob();
  const arrBuf = await dataBlob.arrayBuffer();
  let buffer = Buffer.from(arrBuf);

  const result = await mammoth.convertToHtml(buffer);
  console.log(result);
  let template = "docxEditor";
  let script = `<script>
    const save = document.querySelector('#save');
    save.addEventListener('click', () => {
      document.querySelector('#status').innerText = 'Hang tight! Saving data to salesforce...';
      save.disabled = true;
      fetch('/saveDocData', {
        method: 'POST',
        //mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            data: _editor.getData(), 
            ext: '${ext}', 
            name: '${name}', 
            conDocId: '${contentDocumentId}' 
        })
      })
      .then(response => {
          document.querySelector('#status').innerText = 'Data saved';
          save.disabled = false;
          console.log('The POST request is only used here for the demo purposes');
      })
      .catch((err) => {
          document.querySelector('#status').innerText = err.message;
          save.disabled = false;
      })
    })
  </script>`;
  let options = { data: result.value, script };

  return { template, options };
}

async function processPdf(resp, ext, name, contentDocumentId) {
  const dataBlob = await resp.blob();
  const arrBuf = await dataBlob.arrayBuffer();
  let pdfBuffer = Buffer.from(arrBuf);
  // console.log("pdf buf -> " + pdfBuffer);
  pdfConClient.convertRawDataToFile(
    pdfBuffer,
    "data.html",
    async function (err, fileName) {
      if (err) return console.error("Pdfcrowd Error: " + err);
      console.log("Success: the file was created " + fileName);
    }
  );
  let data = await fs.readFile("data.html", { encoding: "utf8" });
  // let startIdx = data.indexOf("<body>");
  // let endIdx = data.indexOf("</body>");
  // data = data.slice(startIdx, endIdx);
  // data = data.replace("<body>", "");
  // data = data.replace("</body>", "");
  // startIdx = data.indexOf("<img");
  // endIdx = data.indexOf('CC">');
  // let imgEle = data.slice(startIdx, endIdx);
  // data = data.replace('CC">', "");
  // data = data.replace(imgEle, "");
  // data = data.replace("<div", "<p");
  // data = data.replace("</div", "</p");
  console.log("html -> " + data);
  let template = "pdfDisplay";
  let options = { data, script: "" };
  return { template, options };
}

function isNumeric(str) {
  if (typeof str != "string") return false; // we only process strings!
  return (
    !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
    !isNaN(parseFloat(str))
  ); // ...and ensure strings of whitespace fail
}

module.exports = {
  getMimeTypeForExt,
  toDataURL_node,
  saveFile,
  urltoFile,
  processExcel,
  processText,
  htmlToText,
  processDoc,
  processPdf,
  isNumeric,
  processExcelBlob,
};
