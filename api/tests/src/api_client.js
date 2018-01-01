'use strict';

const EventExpectation = require('./event_expectation');
const { waitUntil } = require('./utils');

function formatRange(range)
{
    return `${range.offset}:${range.count}`;
}

function parseRange(arg)
{
    switch (typeof arg)
    {
        case 'number':
            return { offset: arg, count: 1000 };

        case 'string':
        {
            const [ offset = 0, count = 1000 ] = arg.split(':', 2).map(parseInt);
            return { offset, count };
        }

        case 'object':
        {
            const { offset = 0, count = 1000 } = arg;
            return { offset, count };
        }

        default:
            return { offset: 0, count: 1000 };
    }
}

function formatQueryOptions(arg)
{
    if (arg.playlistItems)
    {
        const plrange = formatRange(parseRange(arg.plrange));
        return Object.assign({}, arg, { plrange });
    }
    else
        return arg;
}

class ApiClient
{
    constructor(handler)
    {
        this.handler = handler;
    }

    async resetState()
    {
        await this.stop();
        await this.waitForState(s => s.playbackState === 'stopped');

        await this.setPlayerState({
            order: 'linear',
            loop: 'all',
            isMuted: false,
            volumeDb: 0.0,
        });

        const playlists = await this.getPlaylists();

        for (let p of playlists)
            await this.removePlaylist(p.id);
    }

    async waitUntilReady()
    {
        return waitUntil(() => this.checkIsReady(), 400);
    }

    async checkIsReady()
    {
        try
        {
            await this.getPlayerState();
            return true;
        }
        catch(e)
        {
            return false;
        }
    }

    async getPlayerState(columns)
    {
        const response = await this.handler.get('api/player', { columns });
        return response.player;
    }

    setPlayerState(options)
    {
        return this.handler.post('api/player', options);
    }

    async waitForState(condition)
    {
        const expectation = this.expectUpdate(
            { player: true },
            e => e.player && condition(e.player),
            { useFirstEvent: true });

        await expectation.ready;
        await expectation.done;

        return expectation.lastEvent.player;
    }

    play(plref, item)
    {
        return this.handler.post(`api/player/play/${plref}/${item}`);
    }

    playCurrent()
    {
        return this.handler.post('api/player/play');
    }

    playRandom()
    {
        return this.handler.post('api/player/play/random');
    }

    stop()
    {
        return this.handler.post('api/player/stop');
    }

    pause()
    {
        return this.handler.post('api/player/pause');
    }

    togglePause()
    {
        return this.handler.post('api/player/pause/toggle');
    }

    previous()
    {
        return this.handler.post('api/player/previous');
    }

    next()
    {
        return this.handler.post('api/player/next');
    }

    async getPlaylists()
    {
        const response = await this.handler.get('api/playlists');
        return response.playlists;
    }

    addPlaylist(options)
    {
        return this.handler.post('api/playlists/add', options);
    }

    removePlaylist(plref)
    {
        return this.handler.post(`api/playlists/remove/${plref}`);
    }

    movePlaylist(plref, index)
    {
        return this.handler.post(`api/playlists/move/${plref}/${index}`);
    }

    removePlaylist(plref)
    {
        return this.handler.post(`api/playlists/remove/${plref}`);
    }

    clearPlaylist(plref)
    {
        return this.handler.post(`api/playlists/${plref}/clear`)
    }

    renamePlaylist(plref, title)
    {
        return this.handler.post(`api/playlists/${plref}`, { title });
    }

    setCurrentPlaylist(plref)
    {
        return this.handler.post('api/playlists', { current: plref });
    }

    async getPlaylistItems(plref, columns, range)
    {
        const { offset, count } = parseRange(range);
        const url = `api/playlists/${plref}/items/${offset}:${count}`;
        const response = await this.handler.get(url, { columns });
        return response.playlistItems;
    }

    async getPlaylistFiles(plref, range)
    {
        const items = await this.getPlaylistItems(plref, ['%path%'], range);
        return items.map(i => i.columns[0]);
    }

    addPlaylistItems(plref, items, options)
    {
        const data = { items };

        if (options)
            Object.assign(data, options);

        return this.handler.post(
            `api/playlists/${plref}/items/add`, data);
    }

    sortPlaylistItems(plref, options)
    {
        return this.handler.post(
            `api/playlists/${plref}/items/sort`, options);
    }

    removePlaylistItems(plref, items)
    {
        return this.handler.post(
            `api/playlists/${plref}/items/remove`, { items });
    }

    copyPlaylistItems(plref, items, targetIndex)
    {
        const data = { items, targetIndex };

        return this.handler.post(
            `api/playlists/${plref}/items/copy`, data);
    }

    movePlaylistItems(plref, items, targetIndex)
    {
        const data = { items, targetIndex };

        return this.handler.post(
            `api/playlists/${plref}/items/move`, data);
    }

    copyPlaylistItemsEx(source, target, items, targetIndex)
    {
        const data = { items, targetIndex };

        return this.handler.post(
            `api/playlists/${source}/${target}/items/copy`, data);
    }

    movePlaylistItemsEx(source, target, items, targetIndex)
    {
        const data = { items, targetIndex };

        return this.handler.post(
            `api/playlists/${source}/${target}/items/move`, data);
    }

    async getRoots()
    {
        const response = await this.handler.get('api/browser/roots');
        return response.roots;
    }

    async getEntries(path)
    {
        const response = await this.handler.get('api/browser/entries', { path });
        return response.entries;
    }

    query(options)
    {
        return this.handler.get('api/query', formatQueryOptions(options));
    }

    queryEvents(options, callback)
    {
        return this.handler.createEventSource(
            'api/query/events', callback, options);
    }

    queryUpdates(options, callback)
    {
        return this.handler.createEventSource(
            'api/query/updates', callback, formatQueryOptions(options));
    }

    expectEvent(options, condition, expectationOptions)
    {
        return new EventExpectation(
            cb => this.queryEvents(options, cb),
            condition,
            expectationOptions);
    }

    expectUpdate(options, condition, expectationOptions)
    {
        return new EventExpectation(
            cb => this.queryUpdates(options, cb),
            condition,
            expectationOptions);
    }
}

module.exports = ApiClient;
