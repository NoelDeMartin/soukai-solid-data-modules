import { Bookmark } from '@/modules/Bookmarks';
import Model from './Topic.schema';
import { HasManyRelation } from 'soukai';

export default class Topic extends Model {

    bookmarks?: Bookmark[];
    relatedBookmarks!: HasManyRelation<Bookmark, Topic, typeof Topic>;

    public bookmarksRelationship() {
        return this.hasMany(Bookmark, 'topicUrl');
    }

}
