import { FieldType, TimestampField } from "soukai";
import {
    SolidContainer,
    SolidDocument,
    SolidModel,
    defineSolidModelSchema,
} from "soukai-solid";
import { v4 } from "uuid";
import { ISoukaiDocumentBase } from "../shared/contracts";
import { GetInstanceArgs } from "../types";
import {
    createTypeIndex,
    getTypeIndexFromPofile,
    registerInTypeIndex,
} from "../utils/typeIndexHelpers";

export type ICreateBookmark = {
    hasTopic: string;
    title: string;
    link: string;
};

export type IBookmark = ISoukaiDocumentBase & ICreateBookmark;

export const BookmarkSchema = defineSolidModelSchema({
    rdfContexts: {
        bookm: "http://www.w3.org/2002/01/bookmark#",
        dct: "http://purl.org/dc/terms/",
    },
    rdfsClasses: ["bookm:Bookmark"],
    timestamps: [TimestampField.CreatedAt, TimestampField.UpdatedAt],
    fields: {
        hasTopic: {
            type: FieldType.Any,
            rdfProperty: "bookm:hasTopic",
        },
        title: {
            type: FieldType.String,
            rdfProperty: "dct:title",
        },
        link: {
            type: FieldType.String,
            rdfProperty: "bookm:recalls",
        },
    },
});

export class Bookmark extends BookmarkSchema {
    // protected initialize(attributes: Attributes, exists: boolean): void {
    // }
    // newInstance({ url: "url" }, true)
    // newInstance<T extends Model>(this: T, attributes?: Attributes | undefined, exists?: boolean | undefined): T {
    // }
}

export class BookmarkFactory {
    private static instance: BookmarkFactory;

    private constructor(
        private containerUrls: string[] = [],
        private instancesUrls: string[] = []
    ) { }

    public static async getInstance(
        args?: GetInstanceArgs,
        defaultContainerUrl?: string
    ): Promise<BookmarkFactory> {
        if (!BookmarkFactory.instance) {
            try {
                const baseURL = args?.webId.split("profile")[0]; // https://example.solidcommunity.net/

                defaultContainerUrl = `${baseURL}${defaultContainerUrl ?? "bookmarks/"}`;

                let _containerUrls: string[] = [];
                let _instancesUrls: string[] = [];

                const typeIndexUrl = await getTypeIndexFromPofile({
                    webId: args?.webId ?? "",
                    fetch: args?.fetch,
                    typePredicate: args?.isPrivate
                        ? "solid:privateTypeIndex"
                        : "solid:publicTypeIndex",
                });

                if (typeIndexUrl) {
                    // const res = await fromTypeIndex(typeIndexUrl, Bookmark)

                    const _containers = await SolidContainer.fromTypeIndex(
                        typeIndexUrl,
                        Bookmark
                    );

                    if (!_containers || !_containers.length) {
                        _containerUrls.push(defaultContainerUrl);

                        await registerInTypeIndex({
                            forClass: Bookmark.rdfsClasses[0],
                            instanceContainer: _containerUrls[0],
                            typeIndexUrl: typeIndexUrl,
                        });
                    } else {
                        _containerUrls = [
                            ..._containerUrls,
                            ..._containers.map((c) => c.url),
                        ];
                    }

                    const _instances = await SolidDocument.fromTypeIndex(
                        typeIndexUrl,
                        Bookmark
                    );

                    if (_instances.length) {
                        _instancesUrls = [
                            ..._instancesUrls,
                            ..._instances.map((c) => c.url),
                        ];
                    }
                } else {
                    // Create TypeIndex
                    const typeIndexUrl = await createTypeIndex(
                        args?.webId!,
                        "private",
                        args?.fetch
                    );
                    _containerUrls.push(defaultContainerUrl);

                    // TODO: it inserts two instances
                    await registerInTypeIndex({
                        forClass: Bookmark.rdfsClasses[0],
                        instanceContainer: _containerUrls[0],
                        typeIndexUrl: typeIndexUrl,
                    });
                }

                BookmarkFactory.instance = new BookmarkFactory(
                    _containerUrls,
                    _instancesUrls
                );
            } catch (error: any) {
                console.log(error.message);
            }
        }
        return BookmarkFactory.instance;
    }

    async getAll() {
        const containerPromises = this.containerUrls.map((c) =>
            Bookmark.from(c).all()
        );
        const instancePromises = this.instancesUrls.map((i) =>
            Bookmark.all({ $in: [i] })
        );

        const allPromise = Promise.all([...containerPromises, ...instancePromises]);

        try {
            const values = (await allPromise).flat();
            return values;
        } catch (error) {
            console.log(error);
            return [] as (Bookmark & SolidModel)[];
        }
    }

    async get(pk: string) {
        const res = await Bookmark.findOrFail(pk);

        return res;

        // const containerPromises = this.containerUrls.map(c => Bookmark.from(c).find(id))
        // const instancePromises = this.instancesUrls.map(i => Bookmark.all({ $in: [i] }))

        // const allPromise = Promise.all([...containerPromises, ...instancePromises]);
        // try {
        //     const values = (await allPromise).flat();

        //     return values[0]

        // } catch (error) {
        //     console.log(error);
        //     return undefined
        // }
    }

    async create(payload: ICreateBookmark) {
        const id = v4();

        const bookmark = new Bookmark({
            ...payload,
            id: id,
            url: `${this.containerUrls[0]}${id}`,
        });

        // bookmark.url = `${this.containerUrls[0]}${id}#it`

        return await bookmark.save();
    }

    async update(pk: string, payload: IBookmark) {
        try {
            const res = await Bookmark.findOrFail(pk);
            return await res.update(payload);
        } catch (error) {
            console.log(error);
            return undefined;
        }

        // const promises = this.containerUrls.map(c => Bookmark.from(c).find(id))
        // const allPromise = Promise.all(promises);
        // try {
        //     const values = (await allPromise).flat();

        //     return values.map(v => v?.update(payload))

        // } catch (error) {
        //     console.log(error);
        //     return undefined
        // }
    }

    async remove(pk: string) {
        try {
            const res = await Bookmark.findOrFail(pk);
            return await res.delete();
        } catch (error) {
            console.log(error);
            return undefined;
        }

        // const promises = this.containerUrls.map(c => Bookmark.from(c).find(id))
        // const allPromise = Promise.all(promises);
        // try {
        //     const values = (await allPromise).flat();

        //     return values.map(async (v) => await v?.delete())

        // } catch (error) {
        //     console.log(error);
        //     return undefined
        // }
    }
}
