/**
 * A relationship class that represents the usage of a {@link Primitive} by an {@link Entity}.
 *
 * @private
 */
class PrimitiveInstance {

    /**
     *
     * @param primitiveInstanceIndex
     * @param primitive
     */
    constructor(primitiveInstanceIndex, primitive) {

        /**
         * Index of this PrimitiveInstance in {@link Model#primitiveInstancesList};
         *
         * @type {Number}
         */
        this.primitiveInstanceIndex = primitiveInstanceIndex;

        /**
         * The {@link Primitive} that is being used by the {@link Entity}.
         *
         * @type {Primitive}
         */
        this.primitive = primitive;

        /**
         * The {@link Entity} that uses the {@link Primitive}.
         *
         * @type {Entity}
         */
        this.entity = null; // Set after instantiation, when the Entity is known
    }
}

export {PrimitiveInstance};