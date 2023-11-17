import { FieldType } from 'soukai';
import { defineSolidModelSchema } from 'soukai-solid';

export default defineSolidModelSchema({
    rdfContext: 'http://www.w3.org/2002/01/bookmark#',
    rdfsClass: 'Topic',
    fields: {
        label: {
            type: FieldType.String,
            rdfProperty: 'rdfs:label',
        },
    },
});
