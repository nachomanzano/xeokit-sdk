/**
 * @desc An object that is comprised of one or more {@link Primitive}s.
 *
 * Entity instances are created by {@link Model#createEntity}.
 *
 * An Entity may either share all of its Primitives with other Entities, or exclusively own all of its Primitives.
 *
 * When an Entity shares its Primitives, then {@link Entity#matrix} will transform the Primitives into World-space for that Entity.
 *
 * When an Entity does not share its Primitives, then its {@link Entity#matrix} is never used.
 *
 * @private
 */
class Entity {

    /**
     *
     * @param entityId
     * @param entityIndex
     * @param matrix
     * @param primitiveInstances
     * @param hasReusedPrimitives
     * @param aabb
     */
    constructor(entityId, entityIndex, matrix, primitiveInstances,  aabb, hasReusedPrimitives) {

        /**
         * Unique ID of this Entity.
         *
         * For a BIM model, this will be an IFC product ID.
         *
         * @type {String}
         */
        this.entityId = entityId;

        /**
         * Index of this Entity in {@link Model#entitiesList};
         *
         * @type {Number}
         */
        this.entityIndex = entityIndex;

        /**
         * The 4x4 modeling transform matrix.
         *
         * When the Entity shares its {@link Primitive}s with other Entitys, this matrix is used to transform the
         * shared Primitives into World-space for this Entity. When this Entity does not share its Primitives,
         * this matrix is ignored.
         *
         * @type {Number[]}
         */
        this.matrix = matrix;

        /**
         * A list of {@link PrimitiveInstance}s that indicate which {@link Primitive}s are used by this Entity.
         *
         * @type {PrimitiveInstance[]}
         */
        this.primitiveInstances = primitiveInstances;

        /**
         * World-space axis-aligned bounding box (AABB) that encloses the {@link Primitive#positions} of
         * the {@link Primitive}s that are used by this Entity.
         *
         * @type {Float32Array}
         */
        this.aabb = aabb;

        /**
         * Indicates if this Entity shares {@link Primitive}s with other {@link Entity}'s.
         *
         * When an Entity shares Primitives, it shares all of its Primitives. An Entity never shares only
         * some of its Primitives - it always shares its whole set of Primitives, or none at all.
         *
         * @type {Boolean}
         */
        this.hasReusedPrimitives = hasReusedPrimitives;
    }
}

export {Entity};