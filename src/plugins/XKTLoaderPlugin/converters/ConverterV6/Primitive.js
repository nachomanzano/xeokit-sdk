/**
 * Represents an element of geometry in an XKT file.
 *
 * @private
 */
class Primitive {

    /**
     *
     * @param primitiveId
     * @param primitiveIndex
     * @param color
     * @param opacity
     * @param reused
     * @param positions
     * @param normalsOctEncoded
     * @param indices
     * @param edgeIndices
     */
    constructor(primitiveId, primitiveIndex, color, opacity, reused, positions, normalsOctEncoded, indices, edgeIndices) {

        /**
         * Unique ID of this Primitive.
         *
         * Find the Primitive by this ID in {@link Model#primitives}.
         */
        this.primitiveId = primitiveId;

        /**
         * Index of this Primitive in {@link Model#primitivesList};
         */
        this.primitiveIndex = primitiveIndex;

        /**
         * RGB color of this Primitive.
         */
        this.color = color;

        /**
         * Opacity of this Primitive;
         */
        this.opacity = opacity;

        /**
         * Indicates if this Primitive is used by multiple {@link Entity}s.
         */
        this.reused = reused;

        /**
         * Non-quantized 3D vertex positions.
         *
         * If the Primitive is used by multiple {@link Entity}s, then the positions are in Object-space. If the Primitive is
         * used by only one Entity, then the positions are in World-space.
         *
         * @type {Float32Array}
         */
        this.positions = positions;

        /**
         * Quantized vertex positions.
         *
         * This property is initially ````null````, then is later created by {@link Model#createTiles}.
         *
         * If the Primitive is used by multiple {@link Entity}s, then the positions are in Object-space. If the Primitive is
         * used by only one Entity, then the positions are in World-space.
         *
         * If the Primitive is used by multiple Entity's, then the positions are quantized relative to the collective
         * object-space axis-aligned bounding box (AABB) of all reused Primitives. If the Primitive is used by only
         * one Entity, then the positions are quantized relative to the AABB of the {@link Tile} that contains that Entity.
         *
         * @type {Uint16Array}
         */
        this.positionsQuantized = new Uint16Array(positions.length);

        /**
         * Oct-encoded vertex normals.
         *
         * If the Primitive is used by multiple {@link Entity}s, then the normals are in Object-space. If the Primitive is
         * used by only one Entity, then the normals are in World-space.
         *
         * @type {Int8Array}
         */
        this.normalsOctEncoded = normalsOctEncoded;

        /**
         * Indices to organize the vertex positions and normals into triangles.
         */
        this.indices = indices;

        /**
         * Indices to organize the vertex positions into edges.
         */
        this.edgeIndices = edgeIndices;
    }
}

export {Primitive};