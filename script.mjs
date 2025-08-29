// Requires: npm install node-fetch form-data
// Run: node script.js
import fs from "fs";
import path from "path";
import fetch from "node-fetch"; // not needed in Node v22, you can omit
import FormData from "form-data";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PHOTOPEA_API = "https://www.photopea.com/api"; // Photopea API endpoint
const PSD_FOLDER = path.join(__dirname, "psds");
const INPUT_FOLDER = path.join(__dirname, "inputs");
const OUTPUT_FOLDER = path.join(__dirname, "outputs");

if (!fs.existsSync(OUTPUT_FOLDER)) {
  fs.mkdirSync(OUTPUT_FOLDER);
}

// Collect PSD and input image paths
const psdFiles = fs.readdirSync(PSD_FOLDER).filter((f) => f.endsWith(".psd"));
const inputFiles = fs
  .readdirSync(INPUT_FOLDER)
  .filter((f) => /\.(png|jpg|jpeg)$/i.test(f));

async function processImageWithPSD(psdPath, inputPath) {
  const psdName = path.basename(psdPath, ".psd");
  const inputName = path.basename(inputPath, path.extname(inputPath));
  const outPath = path.join(OUTPUT_FOLDER, `${psdName}_${inputName}.png`);

  const psdBuffer = fs.readFileSync(psdPath);
  const imgBuffer = fs.readFileSync(inputPath);

  const form = new FormData();
  form.append("files[]", psdBuffer, { filename: "template.psd" });
  form.append("files[]", imgBuffer, { filename: "input.png" });

  // Script to run inside Photopea
  const script = `
    app.open("template.psd");
    var doc = app.activeDocument;
    var smart = doc.layers.getByName("Poster");
    app.open("input.png");
    var img = app.activeDocument;
    img.resizeImage(doc.width, doc.height);
    img.selection.selectAll();
    img.selection.copy();
    img.close(SaveOptions.DONOTSAVECHANGES);
    app.activeDocument = doc;
    doc.activeLayer = smart;
    smart.smartObject.replaceContents("input.png");
    doc.saveAs(new File("result.png"), new PNGSaveOptions());
  `;

  const body = {
    files: ["template.psd", "input.png"],
    script: script,
  };

  form.append("script", JSON.stringify(body));

  const res = await fetch(PHOTOPEA_API, { method: "POST", body: form });
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(outPath, Buffer.from(arrayBuffer));
  console.log(`Saved: ${outPath}`);
}

async function run() {
  for (const psd of psdFiles) {
    for (const img of inputFiles) {
      await processImageWithPSD(
        path.join(PSD_FOLDER, psd),
        path.join(INPUT_FOLDER, img)
      );
    }
  }
}

run();
