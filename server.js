require("dotenv").config();
const express = require("express");
const app = express();
const { getSheetData, uploadFileToDrive } = require("./googleAuth");
const {
  redirectToSalesforceLogin,
  getAccessToken,
  getUserDetails,
  queryVersionData,
} = require("./salesforceAuth");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { engine } = require("express-handlebars");
const {
  getMimeTypeForExt,
  saveFile,
  toDataURL_node,
  urltoFile,
} = require("./helper");
const PizZip = require("pizzip");
const PORT = process.env.PORT || 5000;
const fs = require("fs");
const Docxtemplater = require("docxtemplater");
const { read, utils } = require("./sheetjs/xlsx");

app.use(cookieParser());
app.use(
  cors({
    origin: "*",
  })
);
app.engine(".hbs", engine({ extname: ".hbs" }));
app.set("view engine", ".hbs");
app.set("views", "./views");

app.get("/", (_req, res) => {
  res.render("handsontable");
});

// ------------- Google Auth ------------------

app.get("/getSheetData", async (_req, res) => {
  const data = await getSheetData();
  console.log(data);
  res.send(data);
});

// ------------- Salesforce Auth ------------------

app.get("/salesforceAuth", async (req, res) => {
  req.query && req.query.fileId ? res.cookie("fileId", req.query.fileId) : null;
  res.cookie("Revert Uri", req.query.revertUri);
  await redirectToSalesforceLogin(req, res);
});

app.get("/getAccessToken", async (req, res) => {
  const response = await getAccessToken(req, res);
  let revert;
  if (req.cookies["fileId"] !== undefined) {
    revert = "/getData?fileId=" + req.cookies["fileId"];
  } else {
    revert = "/getData";
  }

  res.clearCookie("Revert Uri");
  res.cookie("Instance Url", response.INSTANCE_URL);
  res.cookie("Access Token", response.ACCESS_TOKEN).redirect(revert);
});

app.get("/userData", async (req, res) => {
  const deets = await getUserDetails(req, res);
  res.json(deets);
});

app.get("/getData", async (req, res) => {
  let fileId = req.query.fileId; // /getData?fileId=xxxx
  const deets = await queryVersionData(req, res, fileId);
  // get file data
  let urlStr = deets.records[0].VersionData;
  let name = deets.records[0].PathOnClient;
  let ext = name.split(".").reverse()[0]; // txt or doc or xls ...
  try {
    const resp = await fetch(req.cookies["Instance Url"] + urlStr, {
      method: "GET",
      headers: {
        Authorization: "Bearer " + req.cookies["Access Token"],
      },
    });

    let output;
    let renderTemplate;
    let renderOptions;

    if (ext === "doc") {
      const dataBlob = await resp.blob();
      const arrBuf = await dataBlob.arrayBuffer();
      // const dataBlobURL = URL.createObjectURL(dataBlob);

      // use the buffer as needed
      let buffer = Buffer.from(arrBuf, "binary");
      const pzip = new PizZip();
      const zip = await pzip.load(buffer);
      const doc = new Docxtemplater();
      doc.loadZip(zip);
      output = doc.getZip().generate({ type: "nodebuffer" });
      // write output to file or send as response
      console.log("Output: " + output);
      renderTemplate = "home";
      renderOptions = { data: output };
    } else if (ext === "txt") {
      const dataBlob = await resp.blob();
      output = await dataBlob.text();
      output = "<p>" + output;
      output = output.split("\n").join("<br />");
      output = output.split("\r\n").join("<br />");
      output += "</p>";
      renderTemplate = "home";
      renderOptions = { data: output };
    } else if (ext === "xlsx" || ext === "xls") {
      const f = await resp.arrayBuffer();
      const wb = read(f);
      const data = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      console.log(data);
      let headers = Object.keys(data[0]);
      let script = `<script>
        const container = document.querySelector('#table');
        const hot = new Handsontable(container, {
          data: ${JSON.stringify(data)},
          rowHeaders: true,
          colHeaders: ${JSON.stringify(headers)},
          dropdownMenu: true,
          multiColumnSorting: true,
          filters: true,
          height: 'auto',
          licenseKey: 'non-commercial-and-evaluation' // for non-commercial use only
        });
      </script>`;
      renderTemplate = "handsontable";
      renderOptions = { script };
    }
    // const data = {};
    // data.name = name;
    // data.mimeType = getMimeTypeForExt(ext);
    // data.body = output; // is this valid??
    // data.originalMimeType = dataBlob.type;

    // await uploadFileToDrive(data);

    res.render(renderTemplate, renderOptions);
  } catch (error) {
    console.log(error);
    res.json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
