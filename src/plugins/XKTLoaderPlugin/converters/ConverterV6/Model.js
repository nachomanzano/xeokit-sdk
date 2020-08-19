// const math = require('../lib/math');
// const PrimitiveInstance = require('./PrimitiveInstance');
// const Primitive = require('./Primitive');
// const Entity = require('./Entity');
// const Tile = require('./Tile');
// const geometryCompression = require('../lib/geometryCompression');
// const buildEdgeIndices = require('../lib/buildEdgeIndices');

import {math} from "../lib/math.js";
import {geometryCompression} from "../lib/geometryCompression.js";
import {buildEdgeIndices} from "../lib/buildEdgeIndices.js";
import {PrimitiveInstance} from './PrimitiveInstance.js';
import {Primitive} from './Primitive.js';
import {Entity} from './Entity.js';
import {Tile} from './Tile.js';
import {KDNode} from "./KDNode.js";

const tempVec4a = math.vec4([0, 0, 0, 1]);
const tempVec4b = math.vec4([0, 0, 0, 1]);
const tempMat4 = math.mat4();
const tempMat4b = math.mat4();

const KD_TREE_MAX_DEPTH = 5; // Increase if greater precision needed
const kdTreeDimLength = new Float32Array(3);

/**
 * Represents the contents of an .XKT file.
 *
 * A Model is created by {@link glTFToModel}, and then serialized to .XKT by {@link modelToXKT}.
 *
 * @private
 */
class Model {

    constructor() {

        /**
         * The positions of all shared Primitives are de-quantized using this singular de-quantization matrix.
         *
         * This de-quantization matrix is which is generated from the collective boundary of the positions of all
         * shared Primitives.
         *
         * @type {Float32Array}
         */
        this.instancedPrimitivesDecodeMatrix = math.mat4();

        /**
         * Primitives within this model, each mapped to {@link Primitive#primitiveId}.
         *
         * Created by {@link createPrimitive}.
         */
        this.primitives = {};

        /**
         * Primitives within this Model, in the order they were created.
         *
         * Created by {@link createPrimitive}.
         */
        this.primitivesList = [];

        /**
         * Primitive instances within this Model, in the order they were created.
         *
         * Created by {@link createEntity}.
         */
        this.primitiveInstancesList = [];

        /**
         * Entities within this Model, each mapped to {@link Entity#entityId}.
         *
         * Created by {@link createEntity}.
         */
        this.entities = {};

        /**
         * Entities within this Model, in the order they were created.
         *
         * Created by {@link createEntity}.
         */
        this.entitiesList = [];

        /**
         * Tiles within this Model.
         *
         * Created by {@link createTiles}.
         */
        this.tilesList = [];
    }

    /**
     * Creates a {@link Primitive} within this Model.
     *
     * Called by {@link glTFToModel}.
     *
     * For an reused primitive, ````createPrimitive()```` will ignore the modeling matrix. For a non-reused
     * primitive, ````createPrimitive()```` will immediately transform its positions by the modeling matrix.
     *
     * @param {Number|String} primitiveId Unique ID for the primitive.
     * @param {Boolean} reused True if the primitive is used by multiple Entities.
     * @param {Number[]} modelingMatrix If ````reused```` is ````false````, then ````createPrimitive()```` will transform the
     * primitive's positions by this modeling matrix. This argument is ignored when the primitive is used by multiple entities.
     * @param {Number[]} color RGB color for the primitive, with each color component in range [0..1].
     * @param {Number} opacity Opacity factor for the primitive, in range [0..1].
     * @param {Number[]} positions Floating-point Local-space vertex positions for the primitive.
     * @param {Number[]}normals Floating-point vertex normals for the primitive.
     * @param {Number[]}indices Triangle mesh indices for the primitive.
     * @returns {Primitive} The new Primitive.
     */
    createPrimitive(primitiveId, reused, modelingMatrix, color, opacity, positions, normals, indices) {

        const edgeIndices = buildEdgeIndices(positions, indices, null, 10);

        if (!reused) {

            // Bake non-reused primitive's positions into World-space

            for (let i = 0, len = positions.length; i < len; i += 3) {

                tempVec4a[0] = positions[i + 0];
                tempVec4a[1] = positions[i + 1];
                tempVec4a[2] = positions[i + 2];

                math.transformPoint4(modelingMatrix, tempVec4a, tempVec4b);

                positions[i + 0] = tempVec4b[0];
                positions[i + 1] = tempVec4b[1];
                positions[i + 2] = tempVec4b[2];
            }
        }

        // TODO: Oct-encode normals, in World-space if not reused, otherwise in Model-space?

        const modelNormalMatrix = math.inverseMat4(math.transposeMat4(modelingMatrix, tempMat4b), tempMat4);
        const normalsOctEncoded = new Int8Array(normals.length);

        geometryCompression.transformAndOctEncodeNormals(modelNormalMatrix, normals, normals.length, normalsOctEncoded, 0);

        const primitiveIndex = this.primitivesList.length;

        const primitive = new Primitive(primitiveId, primitiveIndex, color, opacity, reused, positions, normalsOctEncoded, indices, edgeIndices);

        this.primitives[primitiveId] = primitive;
        this.primitivesList.push(primitive);

        return primitive;
    }

    /**
     * Creates an {@link Entity} within this Model.
     *
     * Called by {@link glTFToModel}.
     *
     * @param {String} entityId Unique ID for the Entity.
     * @param {Float32Array} modelingMatrix Modeling matrix for the Entity.
     * @param {String[]} primitiveIds IDs of Primitives used by the Entity.
     * @param {Boolean} hasReusedPrimitives True if the entity shares its Primitives with any other Entities.
     * @returns {Entity} The new Entity.
     */
    createEntity(entityId, modelingMatrix, primitiveIds, hasReusedPrimitives) {

        const primitiveInstances = [];

        const entityAABB = math.AABB3();

        math.collapseAABB3(entityAABB);

        for (let primitiveIdIdx = 0, primitiveIdLen = primitiveIds.length; primitiveIdIdx < primitiveIdLen; primitiveIdIdx++) {

            const primitiveId = primitiveIds[primitiveIdIdx];
            const primitive = this.primitives[primitiveId];

            if (!primitive) {
                console.error("primitive not found: " + primitiveId);
                continue;
            }

            if (hasReusedPrimitives) {

                const positions = primitive.positions;

                for (let i = 0, len = positions.length; i < len; i += 3) {

                    tempVec4a[0] = positions[i];
                    tempVec4a[1] = positions[i + 1];
                    tempVec4a[2] = positions[i + 2];

                    math.transformPoint4(modelingMatrix, tempVec4a, tempVec4b);

                    math.expandAABB3Point3(entityAABB, tempVec4b);
                }

            } else {

                const positions = primitive.positions;

                for (let i = 0, len = positions.length; i < len; i += 3) {

                    tempVec4a[0] = positions[i];
                    tempVec4a[1] = positions[i + 1];
                    tempVec4a[2] = positions[i + 2];

                    math.expandAABB3Point3(entityAABB, tempVec4a);
                }
            }

            const primitiveInstanceIndex = this.primitiveInstancesList.length;

            const primitiveInstance = new PrimitiveInstance(primitiveInstanceIndex, primitive);

            primitiveInstances.push(primitiveInstance);

            this.primitiveInstancesList.push(primitiveInstance);
        }

        const entityIndex = this.entitiesList.length;

        const entity = new Entity(entityId, entityIndex, modelingMatrix, primitiveInstances, entityAABB, hasReusedPrimitives);

        for (let i = 0, len = primitiveInstances.length; i < len; i++) {
            const primitiveInstance = primitiveInstances[i];
            primitiveInstance.entity = entity;
        }

        this.entities[entityId] = entity;
        this.entitiesList.push(entity);

        return entity;
    }

    /**
     * Creates {@link Tiles} within this Model.
     *
     * Internally, builds a kd-Tree populated with {@link Entity}s, then builds Tiles fom the kd-Tree.
     *
     * Called by {@link glTFToModel}.
     */
    createTiles() {

        const rootKDNode = this._createKDTree();

        this._createTilesFromKDTree(rootKDNode);
    }

    _createKDTree() {

        const aabb = math.collapseAABB3();

        for (let entityId in this.entities) {
            if (this.entities.hasOwnProperty(entityId)) {
                const entity = this.entities[entityId];
                math.expandAABB3(aabb, entity.aabb);
            }
        }

        const rootKDNode = new KDNode(aabb);

        for (let entityId in this.entities) {
            if (this.entities.hasOwnProperty(entityId)) {
                const entity = this.entities[entityId];
                const depth = 0;
                const maxKDNodeDepth = KD_TREE_MAX_DEPTH;
                this._insertEntityIntoKDTree(rootKDNode, entity, depth + 1, maxKDNodeDepth);
            }
        }

        return rootKDNode;
    }

    _insertEntityIntoKDTree(kdNode, entity, depth, maxKDTreeDepth) {

        const nodeAABB = kdNode.aabb;
        const entityAABB = entity.aabb;

        if (depth >= maxKDTreeDepth) {
            kdNode.entities = kdNode.entities || [];
            kdNode.entities.push(entity);
            math.expandAABB3(nodeAABB, entityAABB);
            return;
        }

        if (kdNode.left) {
            if (math.containsAABB3(kdNode.left.aabb, entityAABB)) {
                this._insertEntityIntoKDTree(kdNode.left, entity, depth + 1, maxKDTreeDepth);
                return;
            }
        }

        if (kdNode.right) {
            if (math.containsAABB3(kdNode.right.aabb, entityAABB)) {
                this._insertEntityIntoKDTree(kdNode.right, entity, depth + 1, maxKDTreeDepth);
                return;
            }
        }

        kdTreeDimLength[0] = nodeAABB[3] - nodeAABB[0];
        kdTreeDimLength[1] = nodeAABB[4] - nodeAABB[1];
        kdTreeDimLength[2] = nodeAABB[5] - nodeAABB[2];

        let dim = 0;

        if (kdTreeDimLength[1] > kdTreeDimLength[dim]) {
            dim = 1;
        }

        if (kdTreeDimLength[2] > kdTreeDimLength[dim]) {
            dim = 2;
        }

        if (!kdNode.left) {
            const aabbLeft = nodeAABB.slice();
            aabbLeft[dim + 3] = ((nodeAABB[dim] + nodeAABB[dim + 3]) / 2.0);
            kdNode.left = new KDNode(aabbLeft);
            if (math.containsAABB3(aabbLeft, entityAABB)) {
                this._insertEntityIntoKDTree(kdNode.left, entity, depth + 1, maxKDTreeDepth);
                return;
            }
        }

        if (!kdNode.right) {
            const aabbRight = nodeAABB.slice();
            aabbRight[dim] = ((nodeAABB[dim] + nodeAABB[dim + 3]) / 2.0);
            kdNode.right = new KDNode(aabbRight);
            if (math.containsAABB3(aabbRight, entityAABB)) {
                this._insertEntityIntoKDTree(kdNode.right, entity, depth + 1, maxKDTreeDepth);
                return;
            }
        }

        kdNode.entities = kdNode.entities || [];
        kdNode.entities.push(entity);

        math.expandAABB3(nodeAABB, entityAABB);
    }

    _createTilesFromKDTree(rootKDNode) {
        this._createTilesFromKDNode(rootKDNode);
    }

    _createTilesFromKDNode(kdNode) {
        if (kdNode.entities && kdNode.entities.length > 0) {
            this._createTileFromEntities(kdNode.entities, kdNode.aabb);
        }
        if (kdNode.left) {
            this._createTilesFromKDNode(kdNode.left);
        }
        if (kdNode.right) {
            this._createTilesFromKDNode(kdNode.right);
        }
    }

    /**
     * Creates a tile from the given entities.
     *
     * For each non-reused {@link Primitive}, this method centers {@link Primitive#positions} to make them relative to the
     * tile's center, then quantizes the positions to unsigned 16-bit integers, relative to the tile's boundary.
     *
     * @param entities
     * @param aabb
     */
    _createTileFromEntities(entities, aabb) {

        //-----------------------------------------------------------
        // FIXME: aabb is broken
        //-----------------------------------------------------------

        aabb = [-1000,-1000,-1000,1000,1000,1000];

        // Make the positions of all primitives belonging solely to the entities within this tile relative to the tile's center

        const tileCenter = math.getAABB3Center(aabb);

        for (let i = 0; i < entities.length; i++) {

            const entity = entities [i];

            const primitiveInstances = entity.primitiveInstances;

            for (let j = 0, lenj = primitiveInstances.length; j < lenj; j++) {

                const primitiveInstance = primitiveInstances[j];
                const primitive = primitiveInstance.primitive;

                if (!primitive.reused) {

                    const positions = primitive.positions;

                    // Center positions relative to tile center

                    // for (let k = 0, lenk = positions.length; k < lenk; k += 3) {
                    //
                    //     positions[k + 0] -= tileCenter[0];
                    //     positions[k + 1] -= tileCenter[1];
                    //     positions[k + 2] -= tileCenter[2];
                    // }

                    // Quantize positions relative to tile boundary

                    geometryCompression.quantizePositions(positions, positions.length, aabb, primitive.positionsQuantized);
                }
            }
        }

        //const positionsAABB = math.AABB3();
        const positionsAABB = aabb;

        // positionsAABB[0] = aabb[0] - tileCenter[0];
        // positionsAABB[1] = aabb[1] - tileCenter[1];
        // positionsAABB[2] = aabb[2] - tileCenter[2];
        // positionsAABB[3] = aabb[3] - tileCenter[0];
        // positionsAABB[4] = aabb[4] - tileCenter[1];
        // positionsAABB[5] = aabb[5] - tileCenter[2];

        const decodeMatrix = math.mat4();

        geometryCompression.createPositionsDecodeMatrix(positionsAABB, decodeMatrix);

        const tile = new Tile(aabb, decodeMatrix, entities);

        this.tilesList.push(tile);
    }
}

export {Model};