import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server
let sanitizeConfig
let fromQuery
let toQuery

before(async () => {
    server = await createServer({
        server: { middlewareMode: true },
        appType: 'custom',
        optimizeDeps: { noDiscovery: true, include: [] },
    })
    ;({ sanitizeConfig, fromQuery, toQuery } = await server.ssrLoadModule('/src/config.ts'))
})

after(async () => {
    await server?.close()
})

test('showInfobar respects explicit values and defaults', () => {
    assert.equal(sanitizeConfig({ showInfobar: false }).showInfobar, false)
    assert.equal(sanitizeConfig({ showInfobar: true }).showInfobar, true)
    assert.equal(sanitizeConfig({}).showInfobar, true)
})

test('info query parameters round-trip, including legacy values', () => {
    for (const [query, expected] of [['info=false', false], ['info=true', true], ['info=hide', false], ['info=top', true]]) {
        const config = fromQuery(query)
        assert.equal(config.showInfobar, expected, query)
        assert.equal(fromQuery(toQuery(config)).showInfobar, expected, query)
    }
})

test('legacy config and workaround remain supported without overriding the current key', () => {
    assert.equal(sanitizeConfig({ info: 'hide' }).showInfobar, false)
    assert.equal(sanitizeConfig({ info: 'top' }).showInfobar, true)
    assert.equal(sanitizeConfig({ showInfo: false }).showInfobar, false)
    assert.equal(sanitizeConfig({ showInfobar: true, showInfo: false, info: 'hide' }).showInfobar, true)
})
