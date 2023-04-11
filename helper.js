const fs = require("fs").promises;
const mammoth = require("mammoth");
const { read, utils } = require("./sheetjs/xlsx");

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
  console.log(data);
  let headers = Object.keys(data[0]);

  let script = `<script>
    let cols = ${JSON.stringify(headers.map((h) => ({ data: h })))}
    let headers = ${JSON.stringify(headers)}
    let data = ${JSON.stringify(data)}
    let ext = '${ext}'
    let name = '${name}'
    let contentDocumentId = '${contentDocumentId}'
  </script>`;
  return { template: "handsontable", options: { script } };
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
      })
      .catch((err) => {
          document.querySelector('#status').innerText = err.message;
      })
    })
  </script>`;

  return { template: "home", options: { data, script } };
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
  let template = "home";
  let script = `<script>
    const save = document.querySelector('#save');
    save.addEventListener('click', () => {
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
          console.log('The POST request is only used here for the demo purposes');
      })
      .catch((err) => {
          document.querySelector('#status').innerText = err.message;
      })
    })
  </script>`;
  let options = { data: result.value, script };

  return { template, options };
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
};
