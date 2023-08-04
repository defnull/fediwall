# Fediwall

Fediwall is a *media wall* application made for [Mastodon](https://joinmastodon.org/). Follow hashtags or accounts and show the most recent posts in a self-updating, screen filling and visually pleasing masonry grid layout. Put it on a large screen and showcase community feedback or social media reactions while hosting your next big event, or use it to look at cat pictures all day. Your choice.

**Try it!** Check out [fediwall.social](https://fediwall.social/) or host your own (see below).


## Features

* **Follow hashtags, accounts or trends** on multiple servers and display all public posts (including boosts) matching your interest.
* **Visually pleasing** and screen filling masonry grid layout  that scales well with all types of screens, from tablet to large screens or LED walls at venues.
* **Dark mode** for less eye stain and lower energy consumption.
* **Find new posts** quickly and watch them appear with a smooth animation. The update logic gracefully handles Mastodon server rate limits.
* **Moderation tools** allow you to pin important posts, hide inappropriate posts or block entire accounts if necessary.
* **Customize** everything to your liking without the need to host your own instance. Settings are stored in the URL, so you can bookmark or share your personalized wall with others.
* **Self-host** your own if you want. Fediwall is compiled to a static website with no server side logic. Just put it on a webserver and you are done.


## Screenshot (dark/light theme)

![screenshot](https://github.com/defnull/fediwall/assets/62740/d838dfa7-b200-42f5-8130-9506da7dba0f)


## Customization

To customize a Fediwall, scroll down and look for the `[customize]` link. Change the settings to your liking and click apply. The dialog will redirect you to a new URL that represents all your changes and can be bookmarked or shared with others.


### Changing the defaults (self-host only)

Any parameter that is not defined in the URL will fall back to a sensible default value. If you host your own Fediwall, you can of cause change those defaults:

* Generate a `wall-config.json` (see "Advanced" tab in the config editor) and upload it to the Fediwall folder on your webserver (next to `index.html`). Fediwall will try to download this file and use it as default configuration, if present.
* If you plan to build Fediwall from source, you can also change the values in `./src/defaults.ts` directly. Placing a custom `wall-config.json` in the `./public/` folder is easier in most cases, though.


### External configuration

You can link to an externally hosted `wall-config.json` via a special `?load=URL` query parameter. If present, Fediwall will no longer try to download a local `wall-config.json`, but instead fetch default configuration from the specified URL. This is very handy if you want to share Fediwall links but keep the option to change settings later (e.g. to add more hashtags).

Make sure the external webspace allows fetching resources via JavaScript from a different domain (requires proper [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) headers). Github hosted [Gists](https://gist.github.com/) are known to work. For example: `https://fediwall.social/?load=//gist.github.com/[USER]/[GIST]/raw/[FILENAME]`


## Self-hosting Fediwall

Fediwall is compiled into a static website and does not require any server-side framework or runtime to work. Just download a recent build from the [Releases](https://github.com/defnull/fediwall/releases) page (or build from source, see below) and upload the files to a public webspace.

You can host Fediwall directly under a dedicated domain (e.g. `wall.example.com`) or next to an existing application from a separate folder (e.g. `example.com/wall/`). To host Fediwall next to Mastodon on an existing server, find your [nginx config](https://github.com/mastodon/mastodon/blob/main/dist/nginx.conf) and add a new `location` block:

```nginx
server {
    [...]

    location /wall/ {
        alias /path/to/your/fediwall/files/
    }
}
```


## Build from source

You need at least [Node 18](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) and `npm` to build this project.

Checkout or download this repository, run `npm install` once, then `npm run build` to compile everything into a static website. The `./dist/` folder can then be uploaded to a webserver.

During development, `npm run dev` will provide a local development server that automatically compiles and reloads everything on code changes.


## F.A.Q.

### Some posts do not show up. Why?

This can have multiple reasons:

* Fediwall can only find posts that are known to the configured source instances. If you post on a different instance, make sure someone from a source instance follows you or boosts your post.
* Fediwall by default only shows public posts and hides replies, sensitive content or anything with limited visibility. Posts from suspended or limited accounts are also filtered out.
* If all posts from a specific instance are missing, the instance may be down, unresponsive, defederated, or deliberately block anonymous API access.


### It's called Fediwall, but only supports Mastodon. What about X?

Fediwall currently relies on a small subset of the Mastodon v1 API to fetch content, which is also implemented by many Mastodon alternatives. Support for other source APIs (e.g. Pixelfed) is planned, but this may take a while. Pull requests are welcomed, though!

Direct API access is not always necessary. Content shows up on Fediwall no matter on which server or platform it was originally published, as long as it is federated with one of the backing Mastodon servers.


### I want to use Fediwall for my next big event. How do I prevent spam or inappropriate content?

Choose a source server with active moderation to reduce the risk of troll-, spam-, or nsfw-posts showing up. If you see something you do not want, you can manually hide individual posts or entire account in the UI. 

To play it save, stop following hashtags and follow a bunch of trusted event accounts instead. Those accounts would then manually boost posts and only allow approved content to show up on the wall.


## Special thanks

This project was inspired by [Mastowall](https://github.com/rstockm/mastowall), check it out too!


## License

    Copyright (C) 2023  Marcel Hellkamp
    Copyright (C) 2023  Gesellschaft für wissenschaftliche Datenverarbeitung mbH Göttingen

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program. If not, see <https://www.gnu.org/licenses/>.
