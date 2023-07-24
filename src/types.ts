export type Post = {
    id: string;
    url: string;
    content: string;
    date: string;

    author?: {
        name: string;
        avatar?: string;
        url?: string;
    };

    media?: string;
    pinned?: boolean;
};

export type Config = {
    servers: Array<string>,
    tags: Array<string>,
    accounts: Array<string>,

    loadPublic: boolean,
    loadFederated: boolean,
    loadTrends: boolean,

    languages: Array<string>,
    badWords: Array<string>,
    hideSensitive: boolean,
    hideBoosts: boolean,
    hideReplies: boolean,
    hideBots: boolean,

    limit: number,
    interval: number,

    title: string,
    theme: string,
    showInfobar: boolean,

    showText: boolean,
    showMedia: boolean,
    playVideos: boolean,
}