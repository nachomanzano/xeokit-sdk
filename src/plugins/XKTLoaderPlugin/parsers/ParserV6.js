/*

 Parser for .XKT Format V6

.XKT specifications: https://github.com/xeokit/xeokit-sdk/wiki/XKT-Format

 */

import {utils} from "../../../viewer/scene/utils.js";
import * as p from "./lib/pako.js";
import {math} from "../../../viewer/scene/math/math.js";

let pako = window.pako || p;
if (!pako.inflate) {  // See https://github.com/nodeca/pako/issues/97
    pako = pako.default;
}

function extract(elements) {
    return {

        positions: elements[0],
        normals: elements[1],
        indices: elements[2],
        edgeIndices: elements[3],

        matrices: elements[4],

        instancedPrimitivesDecodeMatrix: elements[5],

        eachPrimitivePositionsAndNormalsPortion: elements[6],
        eachPrimitiveIndicesPortion: elements[7],
        eachPrimitiveEdgeIndicesPortion: elements[8],
        eachPrimitiveColorAndOpacity: elements[9],

        primitiveInstances: elements[10],

        eachEntityId: elements[11],
        eachEntityPrimitiveInstancesPortion: elements[12],
        eachEntityMatricesPortion: elements[13],

        eachTileAABB: elements[14],
        eachTileDecodeMatrix: elements[15],
        eachTileEntitiesPortion: elements[16]
    };
}

function inflate(deflatedData) {
    return {

        positions: new Uint16Array(pako.inflate(deflatedData.positions).buffer),
        normals: new Int8Array(pako.inflate(deflatedData.normals).buffer),
        indices: new Uint32Array(pako.inflate(deflatedData.indices).buffer),
        edgeIndices: new Uint32Array(pako.inflate(deflatedData.edgeIndices).buffer),

        matrices: new Float32Array(pako.inflate(deflatedData.matrices).buffer),

        instancedPrimitivesDecodeMatrix: new Float32Array(pako.inflate(deflatedData.instancedPrimitivesDecodeMatrix).buffer),

        eachPrimitivePositionsAndNormalsPortion: new Uint32Array(pako.inflate(deflatedData.eachPrimitivePositionsAndNormalsPortion).buffer),
        eachPrimitiveIndicesPortion: new Uint32Array(pako.inflate(deflatedData.eachPrimitiveIndicesPortion).buffer),
        eachPrimitiveEdgeIndicesPortion: new Uint32Array(pako.inflate(deflatedData.eachPrimitiveEdgeIndicesPortion).buffer),
        eachPrimitiveColorAndOpacity: new Uint8Array(pako.inflate(deflatedData.eachPrimitiveColorAndOpacity).buffer),

        primitiveInstances: new Uint32Array(pako.inflate(deflatedData.primitiveInstances).buffer),

        eachEntityId: pako.inflate(deflatedData.eachEntityId, {to: 'string'}),
        eachEntityPrimitiveInstancesPortion: new Uint32Array(pako.inflate(deflatedData.eachEntityPrimitiveInstancesPortion).buffer),
        eachEntityMatricesPortion: new Uint32Array(pako.inflate(deflatedData.eachEntityMatricesPortion).buffer),

        eachTileAABB: new Float32Array(pako.inflate(deflatedData.eachTileAABB).buffer),
        eachTileDecodeMatrix: new Float32Array(pako.inflate(deflatedData.eachTileDecodeMatrix).buffer),
        eachTileEntitiesPortion: new Uint32Array(pako.inflate(deflatedData.eachTileEntitiesPortion).buffer),
    };
}

const decompressColor = (function () {
    const color2 = new Float32Array(3);
    return function (color) {
        color2[0] = color[0] / 255.0;
        color2[1] = color[1] / 255.0;
        color2[2] = color[2] / 255.0;
        return color2;
    };
})();

function load(viewer, options, inflatedData, performanceModel) {

    const positions = inflatedData.positions;
    const normals = inflatedData.normals;
    const indices = inflatedData.indices;
    const edgeIndices = inflatedData.edgeIndices;

    const matrices = inflatedData.matrices;

    const instancedPrimitivesDecodeMatrix = inflatedData.instancedPrimitivesDecodeMatrix;

    const eachPrimitivePositionsAndNormalsPortion = inflatedData.eachPrimitivePositionsAndNormalsPortion;
    const eachPrimitiveIndicesPortion = inflatedData.eachPrimitiveIndicesPortion;
    const eachPrimitiveEdgeIndicesPortion = inflatedData.eachPrimitiveEdgeIndicesPortion;
    const eachPrimitiveColorAndOpacity = inflatedData.eachPrimitiveColorAndOpacity;

    const primitiveInstances = inflatedData.primitiveInstances;

    const eachEntityId = JSON.parse(inflatedData.eachEntityId);
    const eachEntityPrimitiveInstancesPortion = inflatedData.eachEntityPrimitiveInstancesPortion;
    const eachEntityMatricesPortion = inflatedData.eachEntityMatricesPortion;

    const eachTileAABB = inflatedData.eachTileAABB;
    const eachTileDecodeMatrix = inflatedData.eachTileDecodeMatrix;
    const eachTileEntitiesPortion = inflatedData.eachTileEntitiesPortion;

    const numPrimitives = eachPrimitivePositionsAndNormalsPortion.length;
    const numPrimitiveInstances = primitiveInstances.length;
    const numEntities = eachEntityId.length;
    const numTiles = eachTileEntitiesPortion.length;

    const geometryCreated = {};
    let nextMeshId = 0;

    // Count instances of each primitive

    const primitiveInstanceCounts = new Uint32Array(numPrimitives);

    for (let primitiveInstanceIndex = 0; primitiveInstanceIndex < numPrimitiveInstances; primitiveInstanceIndex++) {
        const primitiveIndex = primitiveInstances[primitiveInstanceIndex];
        primitiveInstanceCounts[primitiveIndex]++;
    }

    // Iterate over tiles

    for (let tileIndex = 0; tileIndex < numTiles; tileIndex++) {

        const lastTileIndex = (numTiles - 1);
        const atLastTile = (tileIndex === lastTileIndex);

        const firstTileEntityIndex = eachTileEntitiesPortion [tileIndex];
        const lastTileEntityIndex = atLastTile ? numEntities : eachTileEntitiesPortion[tileIndex + 1];

        const tileDecodeMatrix = eachTileDecodeMatrix.subarray(tileIndex * 16, (tileIndex * 16) + 16);
        const tileAABB = eachTileAABB.subarray(tileIndex * 6, (tileIndex * 6) + 6);
        const tileCenter = math.getAABB3Center(tileAABB); // TODO: Optimize with cached center

        // console.log("Tile:");
        // console.log(tileDecodeMatrix);
        // console.log(tileAABB);
        // console.log(tileCenter);
        // console.log("\n");

        // Iterate over each tile's entities

        for (let tileEntityIndex = firstTileEntityIndex; tileEntityIndex < lastTileEntityIndex; tileEntityIndex++) {

            const entityId = eachEntityId[tileEntityIndex];

            const entityMatrixIndex = eachEntityMatricesPortion[tileEntityIndex];
            const entityMatrix = matrices.slice(entityMatrixIndex, entityMatrixIndex + 16);

            const lastTileEntityIndex = (numEntities - 1);
            const atLastTileEntity = (tileEntityIndex === lastTileEntityIndex);
            const firstPrimitiveInstanceIndex = eachEntityPrimitiveInstancesPortion [tileEntityIndex];
            const lastPrimitiveInstanceIndex = atLastTileEntity ? primitiveInstances.length : eachEntityPrimitiveInstancesPortion[tileEntityIndex + 1];

            const meshIds = [];

            // Iterate each entity's primitive instances

            for (let primitiveInstancesIndex = firstPrimitiveInstanceIndex; primitiveInstancesIndex < lastPrimitiveInstanceIndex; primitiveInstancesIndex++) {

                const primitiveIndex = primitiveInstances[primitiveInstancesIndex];
                const primitiveInstanceCount = primitiveInstanceCounts[primitiveIndex];
                const isInstancedPrimitive = (primitiveInstanceCount > 1);

                const atLastPrimitive = (primitiveIndex === (numPrimitives - 1));

                const primitivePositions = positions.subarray(eachPrimitivePositionsAndNormalsPortion [primitiveIndex], atLastPrimitive ? positions.length : eachPrimitivePositionsAndNormalsPortion [primitiveIndex + 1]);
                const primitiveNormals = normals.subarray(eachPrimitivePositionsAndNormalsPortion [primitiveIndex], atLastPrimitive ? normals.length : eachPrimitivePositionsAndNormalsPortion [primitiveIndex + 1]);
                const primitiveIndices = indices.subarray(eachPrimitiveIndicesPortion [primitiveIndex], atLastPrimitive ? indices.length : eachPrimitiveIndicesPortion [primitiveIndex + 1]);
                const primitiveEdgeIndices = edgeIndices.subarray(eachPrimitiveEdgeIndicesPortion [primitiveIndex], atLastPrimitive ? edgeIndices.length : eachPrimitiveEdgeIndicesPortion [primitiveIndex + 1]);

                const color = decompressColor(eachPrimitiveColorAndOpacity.subarray((primitiveIndex * 4), (primitiveIndex * 4) + 3));
                const opacity = eachPrimitiveColorAndOpacity[(primitiveIndex * 4) + 3] / 255.0;

                const meshId = nextMeshId++;

                const meshDefaults = {}; // TODO: get from lookup from entity IDs

                if (isInstancedPrimitive) {

                    // Create mesh for multi-use primitive - create (or reuse) geometry, create mesh using that geometry

                    const geometryId = "geometry" + primitiveIndex; // These IDs are local to the PerformanceModel

                    if (!geometryCreated[geometryId]) {

                        performanceModel.createGeometry({
                            id: geometryId,
                            primitive: "triangles",
                            positions: primitivePositions,
                            normals: primitiveNormals,
                            indices: primitiveIndices,
                            edgeIndices: primitiveEdgeIndices,
                            positionsDecodeMatrix: instancedPrimitivesDecodeMatrix
                        });

                        geometryCreated[geometryId] = true;
                    }

                    performanceModel.createMesh(utils.apply(meshDefaults, {
                        id: meshId,
                        geometryId: geometryId,
                        matrix: entityMatrix
                    }));

                } else {

                    // Create mesh for single-use primitive

                    performanceModel.createMesh(utils.apply(meshDefaults, {
                        id: meshId,
                        primitive: "triangles",
                        positions: primitivePositions,
                        normals: primitiveNormals,
                        indices: primitiveIndices,
                        edgeIndices: primitiveEdgeIndices,
                        positionsDecodeMatrix: tileDecodeMatrix,
                        color: color,
                        opacity: opacity
                    }));
                }

                meshIds.push(meshId);
            }

            if (meshIds.length > 0) {

                const entityDefaults = {}; // TODO: get from lookup from entity IDs

                performanceModel.createEntity(utils.apply(entityDefaults, {
                    id: entityId,
                    isObject: true, // TODO: If metaobject exists
                    meshIds: meshIds
                }));
            }
        }
    }
}

/** @private */
const ParserV6 = {
    version: 6,
    parse: function (viewer, options, elements, performanceModel) {
        const deflatedData = extract(elements);
        const inflatedData = inflate(deflatedData);
        load(viewer, options, inflatedData, performanceModel);
    }
};

export {ParserV6};