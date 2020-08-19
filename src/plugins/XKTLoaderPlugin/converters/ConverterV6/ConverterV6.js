/*

 Converts glTF 2 to .XKT format V6.

 Features geometry reuse, oct-encoded normals, quantized positions, tiles with relative-to-center coordinates.

 Designed for accurate geometry and minimal size for geographically large models with fine details. An example of such a
 model would be a long street with a building at each end, with each building having many small elements, such as
 electrical fittings etc.

 EXPERIMENTAL

 See .XKT V6 specification: https://github.com/xeokit/xeokit-sdk/wiki/XKT-Format-V6

 */
import {utils} from "../../../../viewer/scene/utils.js"
import {modelToXKT} from "./modelToXKT.js";
import {glTFToModel} from "./glTFToModel.js";

const fs = require('fs');

function readGltf(gltfPath) {
    return new Promise((resolve, reject) => {

        utils.loadJSON(gltfPath,
            (json) => {
                ok(json);
            },
            function (errMsg) {
                error(errMsg);
            });

        fs.readFile(gltfPath, (error, contents) => {
            if (error !== null) {
                reject(error);
                return;
            }
            resolve(contents);
        });
    });
}

function getBasePath(src) {
    var i = src.lastIndexOf("/");
    return (i !== 0) ? src.substring(0, i + 1) : "";
}

function writeXkt(xktPath, model) {
    return new Promise((resolve, reject) => {
        const xktArrayBuffer = modelToXKT(model);
        console.log("Writing XKT file: " + xktPath);
        fs.writeFile(xktPath, Buffer.from(xktArrayBuffer), (error) => {
            if (error !== null) {
                console.error(`Unable to write to file at path: ${xktPath}`);
                reject(error);
                return;
            }
            resolve();
        });
    });
}

const ConverterV6 = {
    version: 6,
    desc: "Geometry reuse; Oct-encoded normals; Quantized positions; Positions quantized in partitions; EXPERIMENTAL",
    convert: async function convert(gltfPath, xktPath) {
        const content = await readGltf(gltfPath);
        const gltf = JSON.parse(content);
        const basePath = getBasePath(gltfPath);
        const model = await glTFToModel(gltf, {
            basePath: basePath
        });
        await writeXkt(xktPath, model);
    }
};


export {ConverterV6};