import RDFDocument from "@/utils/solid/RDFDocument";
import RDFResourceProperty from "@/utils/solid/RDFResourceProperty";
import { tap } from "@noeldemartin/utils";
import { readFileSync } from "fs";
import { bootModels, setEngine } from "soukai";
import { SolidEngine, bootSolidModels } from "soukai-solid";
import { Bookmark } from "../modules/Bookmarks";
import Topic from "../modules/Topic";
import StubFetcher from "../utils/StubFetcher";

export function loadFixture<T = string>(name: string): T {
  const raw = readFileSync(`${__dirname}/fixtures/${name}`).toString();

  return /\.json(ld)$/.test(name) ? JSON.parse(raw) : raw;
}

const fixture = (name: string) => loadFixture(`bookmarks/${name}`);

describe("Bookmark CRUD", () => {
  let fetch: jest.Mock<Promise<Response>, [RequestInfo, RequestInit?]>;

  beforeEach(() => {
    fetch = jest.fn((...args) => StubFetcher.fetch(...args));
    Bookmark.collection = "https://fake-pod.com/bookmarks/";

    setEngine(new SolidEngine(fetch));
    bootSolidModels();
    bootModels({
      Bookmark,
      Topic,
    });
  });

  it('Uses relationships', async () => {
    // Arrange
    StubFetcher.addFetchResponse(loadFixture('bookmarks/movies.ttl'));
    StubFetcher.addFetchResponse(loadFixture('bookmarks/movies.ttl'));

    // Act
    const topics = await Topic.all({
        $in: ['https://mypod.com/topics'],
    });

    const bookmarks = await Bookmark.all({
        $in: ['https://mypod.com/topics'],
    });

    // Assert
    expect(topics).toHaveLength(9);
    expect(bookmarks).toHaveLength(22);

    expect(bookmarks[0].topic).not.toBeUndefined();
    expect(bookmarks[0].topic?.bookmarks).not.toBeUndefined();
  });

  it("Create", async () => {
    // Arrange
    const label = "Google";
    const topicUrl = "https://mysite.com/search-engine";
    const link = "https://google.com";

    const date = new Date("2023-01-01:00:00Z");

    StubFetcher.addFetchResponse();
    StubFetcher.addFetchResponse();

    // Act
    const bookmark = new Bookmark({ label, topicUrl, link });

    bookmark.metadata.createdAt = date;
    bookmark.metadata.updatedAt = date;

    const res = await bookmark.save();

    // Assert
    expect(res.label).toEqual(label);
    expect(res.topicUrl).toEqual(topicUrl);
    expect(res.link).toEqual(link);

    expect(fetch).toHaveBeenCalledTimes(2);
    // console.log("🚀 ~ file: Bookmark.test.ts:64 ~ it ~ fetch.mock.calls[1]?.[1]?.body:", fetch.mock.calls[1]?.[1]?.body)

    expect(fetch.mock.calls[1]?.[1]?.body).toEqualSparql(`
      INSERT DATA {
            <#it> a <http://www.w3.org/2002/01/bookmark#Bookmark> .
            <#it> <http://www.w3.org/2000/01/rdf-schema#label> "Google" .
            <#it> <http://www.w3.org/2002/01/bookmark#hasTopic> <https://mysite.com/search-engine> .
            <#it> <http://www.w3.org/2002/01/bookmark#recalls> <https://google.com> .
            <#it-metadata> a <https://vocab.noeldemartin.com/crdt/Metadata> .
            <#it-metadata> <https://vocab.noeldemartin.com/crdt/createdAt> "2023-01-01T00:00:00.000Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
            <#it-metadata> <https://vocab.noeldemartin.com/crdt/resource> <#it> .
            <#it-metadata> <https://vocab.noeldemartin.com/crdt/updatedAt> "2023-01-01T00:00:00.000Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
        }
    `);
  });

  it("Read", async () => {
    const label = "Google";
    const topic = "Search Engine";
    const link = "https://google.com";

    // Arrange
    StubFetcher.addFetchResponse(fixture("google.ttl"), {
      "WAC-Allow": 'public="read"',
    });

    // Act
    const bookmark = (await Bookmark.find(
      "solid://bookmarks/google#it"
    )) as Bookmark;
    // console.log(bookmark.link);

    // Assert
    expect(bookmark).toBeInstanceOf(Bookmark);
    expect(bookmark.url).toEqual("solid://bookmarks/google#it");
    expect(bookmark.label).toEqual(label);
    expect(bookmark.topicUrl).toEqual(topic);
    expect(bookmark.link).toEqual(link);
  });

  it("Update", async () => {
    const label = "Google";
    const topic = "Search Engine";
    const link = "https://google.com";

    const date = new Date("2023-01-01:00:00Z");

    // Arrange
    const stub = await createStub({
      label,
      link,
      topic,
    });

    const bookmark = new Bookmark(stub.getAttributes(), true);

    StubFetcher.addFetchResponse();

    // // Act
    bookmark.setAttribute("label", label);
    bookmark.setAttribute("link", link);
    bookmark.setAttribute("topic", topic);

    bookmark.metadata.createdAt = date;
    bookmark.metadata.updatedAt = date;

    await bookmark.save();

    // // Assert
    expect(bookmark.label).toBe(label);
    expect(fetch).toHaveBeenCalledTimes(2);

    expect(fetch.mock.calls[1]?.[1]?.body).toEqualSparql(`
      DELETE DATA {
        <#it-metadata> <https://vocab.noeldemartin.com/crdt/resource> <#it> .
      };
      INSERT DATA {
        <#it-metadata> a <https://vocab.noeldemartin.com/crdt/Metadata> .
        <#it-metadata> <https://vocab.noeldemartin.com/crdt/createdAt> "2023-01-01T00:00:00.000Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
        <#it-metadata> <https://vocab.noeldemartin.com/crdt/resource> <#it> .
        <#it-metadata> <https://vocab.noeldemartin.com/crdt/updatedAt> "2023-01-01T00:00:00.000Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
      }
    `);
  });

});

async function createStub(attributes: {
  label: string;
  link: string;
  topic: string;
}): Promise<Bookmark> {
  return tap(new Bookmark(attributes, true), async (stub) => {
    stub.mintUrl();
    stub.cleanDirty();

    const document = await RDFDocument.fromJsonLD(stub.toJsonLD());
    const turtle = RDFResourceProperty.toTurtle(
      document.properties,
      document.url
    );

    StubFetcher.addFetchResponse(turtle);
  });
}
